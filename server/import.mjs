import {createHmac,timingSafeEqual,randomUUID} from 'node:crypto';
import {digest} from './auth.mjs';
import {transaction} from './db.mjs';
import {validateBackup,fail} from './model.mjs';
import {insert} from './store.mjs';

const checksum=data=>digest(JSON.stringify(data)).toString('hex');
export function importService(pool,secret) {
  const sign=value=>createHmac('sha256',secret).update(value).digest('hex');
  function preview(owner,source,backup) {
    if (typeof source!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(source)) fail('Use an import source name of 1–80 letters, digits, underscores or hyphens.');
    const checked=validateBackup(backup);
    const claims=Buffer.from(JSON.stringify({owner,source,checksum:checksum(backup),expires:Date.now()+900000})).toString('base64url');
    return {token:claims+'.'+sign(claims),counts:checked.counts,message:'Import into an empty notebook. All content starts private. Existing browser data is preserved.'};
  }
  async function commit(owner,backup,token) {
    if (typeof token!=='string'||token.length>4096) fail('Preview this backup before importing.');
    const [claims,signature]=token.split('.');
    const expected=Buffer.from(sign(claims??''),'hex'), actual=Buffer.from(signature??'','hex');
    if (actual.length!==expected.length||!timingSafeEqual(actual,expected)) fail('Invalid import preview.');
    let p; try { p=JSON.parse(Buffer.from(claims,'base64url').toString()); } catch { fail('Invalid import preview.'); }
    if (p.owner!==owner||p.expires<Date.now()||p.checksum!==checksum(backup)) fail('Backup changed or preview expired. Preview it again.');
    const checked=validateBackup(backup);
    return transaction(pool,async c=>{
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[owner]);
      const receipt=(await c.query('SELECT * FROM import_receipts WHERE owner_id=$1 AND source=$2',[owner,p.source])).rows[0];
      if (receipt) {
        if (receipt.checksum!==p.checksum) fail('This import source already has a different committed backup. No records were changed.',409);
        return {counts:receipt.counts,repeated:true};
      }
      // No destructive restore: imports may only initialize a pristine notebook.
      const profile=(await c.query('SELECT revision FROM profiles WHERE owner_id=$1 FOR UPDATE',[owner])).rows[0];
      if (Number(profile?.revision)!==1) fail('Import requires an empty, unedited notebook. Export existing server data first; nothing was replaced.',409);
      for (const table of ['entries','tasks','resource_links','anime_logs','reminders','books','book_folders'])
        if ((await c.query(`SELECT 1 FROM ${table} WHERE owner_id=$1 LIMIT 1`,[owner])).rows.length) fail('Import requires an empty notebook, including trash. Nothing was replaced.',409);
      const profileKeys=Object.keys(checked.profile);
      await c.query(`UPDATE profiles SET ${profileKeys.map((k,i)=>`${k}=$${i+1}`).join(',')},revision=revision+1,updated_at=now() WHERE owner_id=$${profileKeys.length+1}`,[...Object.values(checked.profile),owner]);
      const tables={posts:'entries',blogs:'entries',tasks:'tasks',documents:'resource_links',anime:'anime_logs',events:'reminders',books:'books'};
      const bookMap=new Map();
      const folderMap=new Map();
      for (const folder of checked.folders) {
        const id=randomUUID();folderMap.set(folder.id,id);
        await insert(c,'book_folders',{id,owner_id:owner,title:folder.title});
      }
      for (const [key,records] of Object.entries(checked.records)) for (const record of records) {
        const id=randomUUID();
        const values={...record.values};
        if (key==='books') values.folder_id=folderMap.get(values.folder_id)??null;
        await insert(c,tables[key],{id,owner_id:owner,...values,legacy_source:p.source,legacy_collection:key,legacy_id:record.legacyId,legacy_position:record.position});
        if (key==='books') {
          bookMap.set(record.legacyId,id);
          await insert(c,'book_contents',{book_id:id,...(record.binary?{content_binary:record.binary}:{content_text:record.text}),content_sha256:digest(record.binary??record.text)});
        }
      }
      for (const r of checked.reading) await insert(c,'reading_progress',{owner_id:owner,book_id:bookMap.get(r.legacyId),...r.values});
      await insert(c,'import_receipts',{owner_id:owner,source:p.source,checksum:p.checksum,counts:JSON.stringify(checked.counts)});
      return {counts:checked.counts,repeated:false};
    });
  }
  return {preview,commit};
}
