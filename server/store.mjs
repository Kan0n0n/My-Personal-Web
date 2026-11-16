import {randomUUID} from 'node:crypto';
import {transaction} from './db.mjs';
import {digest} from './auth.mjs';
import {checkBookFile} from './book-files.mjs';
import {collections,descriptor,validateRecord,validateProfile,encode,encodeRecord,profileFields,revision,uuid,fail,emptyNotebook,validateProgress,bookText} from './model.mjs';

export async function insert(c,table,values) {
  const keys=Object.keys(values);
  return (await c.query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,Object.values(values))).rows[0];
}
function scope(key) { return key==='posts'?" AND kind='note'":key==='blogs'?" AND kind IN ('blog','story')":''; }
export async function list(c,owner,key,{publicRead=false,trash=false,limit=500,offset=0}={}) {
  const d=descriptor(key);
  if (publicRead&&!d.publish) return [];
  const where=`owner_id=$1 AND deleted_at IS ${trash?'NOT ':''}NULL${scope(key)}${publicRead?" AND publication_state='published'":''}`;
  // Keep legacy array order; new records precede the imported historical block.
  return (await c.query(`SELECT * FROM ${d.table} WHERE ${where} ORDER BY (legacy_position IS NULL) DESC, CASE WHEN legacy_position IS NULL THEN created_at END DESC, legacy_source,legacy_position,id LIMIT $2 OFFSET $3`,[owner,limit,offset])).rows.map(row=>encodeRecord(key,row,publicRead));
}
export async function allRecords(c,owner,key,options={}) {
  const result=[];
  for (let offset=0;;offset+=500) {
    const page=await list(c,owner,key,{...options,offset,limit:500}); result.push(...page);
    if (page.length<500) return result;
  }
}
export async function notebook(c,owner,publicRead=false) {
  const data=emptyNotebook();
  if (!owner) return data;
  const row=(await c.query('SELECT * FROM profiles WHERE owner_id=$1',[owner])).rows[0];
  if (row) {
    // The owner's soundtrack is public independently of personal profile visibility.
    const fields=publicRead&&!row.is_public
      ? Object.fromEntries(['song','artist','musicCover','musicUrl'].map(key=>[key,profileFields[key]]))
      : profileFields;
    data.profile=encode(fields,row);
    if (!publicRead) data.profile.revision=Number(row.revision);
  }
  for (const key of Object.keys(collections).filter(k=>k!=='books')) data[key]=await allRecords(c,owner,key,{publicRead});
  if (!publicRead) {
    for (const r of (await c.query('SELECT p.* FROM reading_progress p JOIN books b ON b.id=p.book_id AND b.owner_id=p.owner_id WHERE p.owner_id=$1 AND b.deleted_at IS NULL',[owner])).rows)
      data.reading[r.book_id]=encodeProgress(r);
  }
  return data;
}
export async function updateProfile(c,owner,data) {
  const values=validateProfile(data), rev=revision(data.revision), keys=Object.keys(values);
  const result=await c.query(`UPDATE profiles SET ${keys.map((k,i)=>`${k}=$${i+1}`).join(',')},updated_at=now(),revision=revision+1 WHERE owner_id=$${keys.length+1} AND revision=$${keys.length+2} RETURNING *`,[...Object.values(values),owner,rev]);
  if (!result.rows.length) fail('Profile changed on another device. Reload and review your changes.',409);
  return {...encode(profileFields,result.rows[0]),revision:Number(result.rows[0].revision)};
}
export async function createRecord(pool,owner,key,data) {
  const d=descriptor(key), values=validateRecord(key,data);
  if (key==='books'&&!['txt','md'].includes(values.format)) fail('Use the file upload endpoint for PDF and EPUB.');
  return transaction(pool,async c=>{
    if (key==='books') await checkFolder(c,owner,values.folder_id);
    const row=await insert(c,d.table,{id:randomUUID(),owner_id:owner,...values});
    if (key==='books') await insert(c,'book_contents',{book_id:row.id,content_text:bookText(data.text),content_sha256:digest(data.text)});
    return encodeRecord(key,row);
  });
}
export async function updateRecord(pool,owner,key,id,data) {
  const d=descriptor(key), values=validateRecord(key,data), rev=revision(data.revision); uuid(id);
  if (key==='books' && Object.hasOwn(data,'text')) fail('Import a new book to keep the existing text and bookmark safe.');
  const keys=Object.keys(values);
  const result=await transaction(pool,async c=>{
    if (key==='books') {
      await checkFolder(c,owner,values.folder_id);
      const old=(await c.query('SELECT format FROM books WHERE id=$1 AND owner_id=$2 FOR UPDATE',[id,owner])).rows[0];
      if (old&&old.format!==values.format) fail('A book’s file format cannot be changed. Upload a new copy.');
    }
    return c.query(`UPDATE ${d.table} SET ${keys.map((k,i)=>`${k}=$${i+1}`).join(',')},updated_at=now(),revision=revision+1 WHERE id=$${keys.length+1} AND owner_id=$${keys.length+2} AND revision=$${keys.length+3} AND deleted_at IS NULL${scope(key)} RETURNING *`,[...Object.values(values),id,owner,rev]);
  });
  if (!result.rows.length) fail('Record changed or is unavailable. Reload and review your changes.',409);
  return encodeRecord(key,result.rows[0]);
}
export async function recordAction(c,owner,key,id,action,data) {
  uuid(id); const d=descriptor(key), rev=revision(data.revision);
  let set,deleted=false;
  if (action==='trash') set='deleted_at=now()';
  else if (action==='restore') { set='deleted_at=NULL'; deleted=true; }
  else if (action==='publish'&&d.publish) set="publication_state='published',published_at=now()";
  else if (action==='unpublish'&&d.publish) set="publication_state='draft',published_at=NULL";
  else fail('Unknown record action.',404);
  const result=await c.query(`UPDATE ${d.table} SET ${set},revision=revision+1,updated_at=now() WHERE id=$1 AND owner_id=$2 AND revision=$3 AND deleted_at IS ${deleted?'NOT ':''}NULL${scope(key)} RETURNING *`,[id,owner,rev]);
  if (!result.rows.length) fail('Record changed or is unavailable. Reload before trying again.',409);
  return encodeRecord(key,result.rows[0]);
}
export async function content(c,owner,id) {
  uuid(id);
  const row=(await c.query('SELECT c.content_text,b.format FROM book_contents c JOIN books b ON b.id=c.book_id WHERE b.id=$1 AND b.owner_id=$2 AND b.deleted_at IS NULL',[id,owner])).rows[0];
  if (!row) fail('Book not found.',404);
  if (row.content_text===null) fail('Use the file endpoint to read PDF and EPUB books.');
  return {text:row.content_text};
}
export async function progress(pool,owner,id,data) {
  uuid(id); const values=validateProgress(data);
  return transaction(pool,async c=>{
    const b=await c.query('SELECT id FROM books WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL FOR UPDATE',[id,owner]);
    if (!b.rows.length) fail('Book not found.',404);
    const old=(await c.query('SELECT revision FROM reading_progress WHERE owner_id=$1 AND book_id=$2',[owner,id])).rows[0];
    let row;
    if (old) {
      if (revision(data.revision)!==Number(old.revision)) fail('Bookmark changed on another device. Reload before saving.',409);
      const keys=Object.keys(values);
      row=(await c.query(`UPDATE reading_progress SET ${keys.map((key,i)=>`${key}=$${i+1}`).join(',')},revision=revision+1,updated_at=now() WHERE owner_id=$${keys.length+1} AND book_id=$${keys.length+2} RETURNING *`,[...Object.values(values),owner,id])).rows[0];
    } else {
      if (data.revision!=null) fail('Bookmark is unavailable. Reload before saving.',409);
      row=await insert(c,'reading_progress',{owner_id:owner,book_id:id,...values});
    }
    return encodeProgress(row);
  });
}
function encodeProgress(row) {
  return {progress:Number(row.progress_percent),font:row.font_size_px,theme:row.reader_theme,locator:row.locator,fontFamily:row.reader_font_family,anchor:row.view_anchor,alignment:row.text_alignment,speech:row.speech_preferences,revision:Number(row.revision)};
}
export async function exportBackup(pool,owner) {
  return transaction(pool,async c=>{
    await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    const data=await notebook(c,owner), books=await allRecords(c,owner,'books');
    for (const b of books) {
      if (['pdf','epub'].includes(b.format)) b.base64=(await bookFile(c,owner,b.id)).bytes.toString('base64');
      else b.text=(await content(c,owner,b.id)).text;
    }
    return {notebook:data,books,folders:await folders(c,owner)};
  });
}

async function checkFolder(c,owner,id) {
  if (id===null) return;
  uuid(id);
  if (!(await c.query('SELECT id FROM book_folders WHERE id=$1 AND owner_id=$2 FOR KEY SHARE',[id,owner])).rows.length) fail('Folder not found.',404);
}
export async function folders(c,owner) {
  return (await c.query('SELECT id,title,revision FROM book_folders WHERE owner_id=$1 ORDER BY title,id',[owner])).rows.map(r=>({...r,revision:Number(r.revision)}));
}
export async function saveFolder(c,owner,id,data) {
  if (typeof data.title!=='string'||!data.title.trim()||data.title.length>500) fail('Use a folder name of 1–500 characters.');
  if (!id) return insert(c,'book_folders',{id:randomUUID(),owner_id:owner,title:data.title.trim()});
  uuid(id);
  const result=await c.query('UPDATE book_folders SET title=$1,revision=revision+1 WHERE id=$2 AND owner_id=$3 AND revision=$4 RETURNING id,title,revision',[data.title.trim(),id,owner,revision(data.revision)]);
  if (!result.rows.length) fail('Folder changed or is unavailable. Reload before trying again.',409);
  return {...result.rows[0],revision:Number(result.rows[0].revision)};
}
export async function removeFolder(pool,owner,id,data) {
  uuid(id);
  return transaction(pool,async c=>{
    const folder=(await c.query('SELECT revision FROM book_folders WHERE id=$1 AND owner_id=$2 FOR UPDATE',[id,owner])).rows[0];
    if (!folder||Number(folder.revision)!==revision(data.revision)) fail('Folder changed or is unavailable. Reload before trying again.',409);
    await c.query('UPDATE books SET folder_id=NULL,revision=revision+1,updated_at=now() WHERE owner_id=$1 AND folder_id=$2',[owner,id]);
    await c.query('DELETE FROM book_folders WHERE id=$1 AND owner_id=$2',[id,owner]);
    return {ok:true};
  });
}
export async function uploadBook(pool,owner,data,bytes) {
  const values=validateRecord('books',data); checkBookFile(values.format,bytes);
  return transaction(pool,async c=>{
    await checkFolder(c,owner,values.folder_id);
    const row=await insert(c,'books',{id:randomUUID(),owner_id:owner,...values});
    await insert(c,'book_contents',{book_id:row.id,content_binary:bytes,content_sha256:digest(bytes)});
    return encodeRecord('books',row);
  });
}
export async function bookFile(c,owner,id) {
  uuid(id);
  const row=(await c.query('SELECT b.format,c.content_binary FROM books b JOIN book_contents c ON c.book_id=b.id WHERE b.id=$1 AND b.owner_id=$2 AND b.deleted_at IS NULL',[id,owner])).rows[0];
  if (!row||!row.content_binary) fail('Book file not found.',404);
  return {format:row.format,bytes:Buffer.from(row.content_binary)};
}
