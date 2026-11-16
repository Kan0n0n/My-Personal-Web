import assert from 'node:assert/strict';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {migrate,database} from '../server/db.mjs';
import {createOwner,digest} from '../server/auth.mjs';
import {createAPI} from '../server/api.mjs';
import {createHandler} from '../scripts/serve.mjs';
import {samplePDF,sampleEPUB} from './fixtures/books.mjs';

// PGlite runs the PostgreSQL engine, not SQL mocks. Optionally run this suite
// against an EMPTY dedicated PostgreSQL database using TEST_DATABASE_URL.
const embedded=process.env.TEST_DATABASE_URL?null:new PGlite();
const query=async(sql,params)=>params===undefined?(await embedded.exec(sql,{parsers:{1082:x=>x}})).at(-1):embedded.query(sql,params,{parsers:{1082:x=>x}});
const pool=embedded?{query,connect:async()=>({query,release(){}})}:database(process.env.TEST_DATABASE_URL);
let server,checks=0;
const test=async(name,fn)=>{await fn();checks++;console.log('  passed:',name);};
try {
  await migrate(pool); await migrate(pool);
  await test('domain tables, series folders, receipt and migration history',async()=>{
    const {rows}=await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    assert.equal(rows.length,14);
  });
  const owner=await createOwner(pool,'philine','correct horse battery staple');
  const other=await createOwner(pool,'other','another private password');
  const config={origin:'http://127.0.0.1:4173',importSecret:'test-secret-'.repeat(5),ownerLogin:'philine',sessionDays:7};
  server=http.createServer(createHandler(createAPI(pool,config)));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  async function request(path,{method='GET',body,cookie='',origin=config.origin}={}) {
    const res=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(method==='GET'?{}:{Origin:origin,'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'manual'});
    const type=res.headers.get('content-type')??'';
    return {status:res.status,headers:res.headers,data:type.includes('json')?await res.json():await res.text()};
  }
  const login=await request('/api/auth/login',{method:'POST',body:{login:'philine',password:'correct horse battery staple'}});
  assert.equal(login.status,200); const cookie=login.headers.get('set-cookie').split(';')[0];
  const login2=await request('/api/auth/login',{method:'POST',body:{login:'other',password:'another private password'}});
  const cookie2=login2.headers.get('set-cookie').split(';')[0];
  const me=(path,method='GET',body)=>request('/api/me/'+path,{method,body,cookie});
  const backup={notebook:{version:1,profile:{name:'Philine',musicUrl:'https://www.youtube.com/watch?v=M7lc1UVf-VE',musicCover:'https://i.ytimg.com/a.jpg',song:'A song',artist:'An artist'},posts:[{id:'old-note',title:'A memory',date:'2026-11-05',body:'Hello 世界 ♡',tags:'life / notes'}],blogs:[{id:'old-story',title:'A story',date:'2026-11-05',body:'Once upon a time',category:'Story'}],tasks:[{id:'old-task',title:'Prepare',status:'In progress',due:'',note:''}],documents:[{id:'old-doc',title:'Lesson',url:'https://example.com',folder:'School'}],anime:[{id:'old-anime',title:'A show',date:'2026-11-05',status:'Completed',rating:'4',episodes:'12',body:'Thoughts',spoilers:true}],events:[{id:'old-reminder',title:'Remember',date:'2026-11-07'}],reading:{'folder/story.txt':{progress:37.5,font:20}}},books:[{id:'folder/story.txt',title:'A novel',text:'Chapter one\nこんにちは'}]};
  await test('authentication, CSRF and static file isolation',async()=>{
    assert.equal((await request('/api/me/notebook')).status,401);
    assert.equal((await request('/api/auth/login',{method:'POST',body:{login:'philine',password:'bad'}})).status,401);
    assert.equal((await request('/api/me/profile',{method:'PUT',body:{},cookie,origin:'https://evil.test'})).status,403);
    for (const file of ['/server/auth.mjs','/server/migrations/001_initial.sql','/.env','/package.json','/backups/private.json','/node_modules/pg/package.json']) assert.equal((await request(file)).status,403,file);
    assert.equal((await request('/pages/index.html')).status,200);
    assert.equal((await request('/posts.html')).status,302);
    assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
    const stored=(await pool.query('SELECT token_hash FROM sessions WHERE owner_id=$1',[owner])).rows[0];
    assert.notEqual(Buffer.from(stored.token_hash).toString('hex'),cookie.split('=')[1]);
  });
  let token;
  await test('complete import preview and tamper protection',async()=>{
    const preview=await me('import/preview','POST',{source:'old-browser',backup});
    assert.equal(preview.status,200); assert.equal(preview.data.counts.books,1); token=preview.data.token;
    const altered=structuredClone(backup); altered.notebook.posts[0].body='changed';
    assert.equal((await me('import/commit','POST',{backup:altered,token})).status,400);
    const bad=structuredClone(backup); bad.notebook.anime[0].episodes='NaN';
    assert.equal((await me('import/preview','POST',{source:'bad',backup:bad})).status,400);
    const orphan=structuredClone(backup); orphan.books=[];
    assert.equal((await me('import/preview','POST',{source:'orphan',backup:orphan})).status,400);
  });
  await test('atomic rollback if a database write fails halfway through import',async()=>{
    await pool.query("CREATE FUNCTION fail_test_task() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$");
    await pool.query('CREATE TRIGGER fail_test_task BEFORE INSERT ON tasks FOR EACH ROW EXECUTE FUNCTION fail_test_task()');
    assert.equal((await me('import/commit','POST',{backup,token})).status,503);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM entries WHERE owner_id=$1',[owner])).rows[0].n,0);
    assert.equal(Number((await pool.query('SELECT revision FROM profiles WHERE owner_id=$1',[owner])).rows[0].revision),1);
    await pool.query('DROP TRIGGER fail_test_task ON tasks'); await pool.query('DROP FUNCTION fail_test_task()');
  });
  let notebook,bookId;
  await test('legacy IDs, Unicode text, labels and bookmarks survive import',async()=>{
    const result=await me('import/commit','POST',{backup,token}); assert.equal(result.status,200);
    notebook=(await me('notebook')).data;
    const books=(await me('records/books')).data; bookId=books[0].id;
    assert.notEqual(bookId,backup.books[0].id);
    assert.equal(notebook.posts[0].body,'Hello 世界 ♡'); assert.equal(notebook.blogs[0].category,'Story');
    assert.equal(notebook.tasks[0].status,'In progress'); assert.equal(notebook.tasks[0].due,null);
    assert.equal(notebook.anime[0].rating,4); assert.equal(notebook.anime[0].spoilers,true);
    assert.equal(notebook.profile.musicUrl,backup.notebook.profile.musicUrl);
    assert.equal(notebook.reading[bookId].progress,37.5); assert.equal(notebook.reading[bookId].font,20);
    assert.equal((await me(`books/${bookId}/content`)).data.text,backup.books[0].text);
    assert.equal(notebook.posts[0].publication_state,'draft');
    const raw=(await pool.query('SELECT content_sha256 FROM book_contents WHERE book_id=$1',[bookId])).rows[0];
    assert.deepEqual(Buffer.from(raw.content_sha256),digest(backup.books[0].text));
  });
  await test('retry is idempotent; changed or nonempty imports never replace records',async()=>{
    assert.equal((await me('import/commit','POST',{backup,token})).data.repeated,true);
    assert.equal((await me('notebook')).data.posts.length,1);
    const changed=structuredClone(backup); changed.notebook.profile.name='Changed';
    const p=(await me('import/preview','POST',{source:'old-browser',backup:changed})).data;
    assert.equal((await me('import/commit','POST',{backup:changed,token:p.token})).status,409);
    const p2=(await me('import/preview','POST',{source:'new-source',backup})).data;
    assert.equal((await me('import/commit','POST',{backup,token:p2.token})).status,409);
  });
  await test('public responses exclude drafts and every private collection',async()=>{
    const pub=(await request('/api/public/notebook')).data;
    assert.deepEqual(pub.profile,Object.fromEntries(['song','artist','musicCover','musicUrl'].map(key=>[key,backup.notebook.profile[key]])));
    for (const key of ['posts','blogs','anime','tasks','documents','events']) assert.equal(pub[key].length,0);
    assert.deepEqual(pub.reading,{});
    const note=notebook.posts[0];
    assert.equal((await me(`records/posts/${note.id}/publish`,'POST',{revision:note.revision})).status,200);
    const p=(await request('/api/public/notebook')).data.posts[0];
    assert.equal(p.title,note.title); assert.equal(p.revision,undefined); assert.equal(p.owner_id,undefined);
  });
  await test('visitors see updated music with a private profile but cannot change it',async()=>{
    const profile=(await me('notebook')).data.profile;
    const updated={...profile,song:'Today’s soundtrack',artist:'Owner selection',musicUrl:'https://www.youtube.com/watch?v=abcdefghijk',musicCover:'https://i.ytimg.com/new.jpg',is_public:false};
    assert.equal((await me('profile','PUT',updated)).status,200);
    const publicProfile=(await request('/api/public/notebook')).data.profile;
    assert.deepEqual(publicProfile,Object.fromEntries(['song','artist','musicCover','musicUrl'].map(key=>[key,updated[key]])));
    assert.equal(publicProfile.name,undefined);
    assert.equal(publicProfile.revision,undefined);
    assert.equal((await request('/api/me/profile',{method:'PUT',body:updated})).status,401);
    const current=(await me('notebook')).data.profile;
    assert.equal((await me('profile','PUT',{...profile,revision:current.revision})).status,200);
  });
  await test('owned writes, stale edits and cross-owner access',async()=>{
    const note=(await me('notebook')).data.posts[0];
    const saved=await me(`records/posts/${note.id}`,'PUT',{...note,title:'Edited'}); assert.equal(saved.status,200);
    assert.equal((await me(`records/posts/${note.id}`,'PUT',{...note,title:'Stale'})).status,409);
    assert.equal((await request(`/api/me/books/${bookId}/content`,{cookie:cookie2})).status,404);
    assert.equal((await request(`/api/me/books/${bookId}/progress`,{method:'PUT',body:{progress:50,font:18},cookie:cookie2})).status,404);
    assert.equal((await request(`/api/me/records/posts/${note.id}/trash`,{method:'POST',body:{revision:saved.data.revision},cookie:cookie2})).status,409);
    assert.equal((await me('records/documents','POST',{title:'Unsafe',url:'javascript:alert(1)'})).status,400);
    assert.equal((await me('records/posts','POST',{title:'Bad date',date:'2026-02-30',body:'text'})).status,400);
  });
  await test('database enforces ownership and numerical constraints',async()=>{
    await assert.rejects(()=>pool.query('INSERT INTO reading_progress(owner_id,book_id) VALUES($1,$2)',[other,bookId]),e=>e.code==='23503');
    await assert.rejects(()=>pool.query('UPDATE anime_logs SET rating=6 WHERE owner_id=$1',[owner]),e=>e.code==='23514');
    await assert.rejects(()=>pool.query('UPDATE reading_progress SET progress_percent=101 WHERE owner_id=$1',[owner]),e=>e.code==='23514');
  });
  await test('book create/content, progress conflicts and recoverable trash',async()=>{
    const created=await me('records/books','POST',{title:'New book',format:'txt',sourcePath:'same.txt',text:'Text'}); assert.equal(created.status,201);
    const b=created.data;
    assert.equal((await me('records/books')).data[0].text,undefined,'Shelf omits full text');
    const progress=await me(`books/${b.id}/progress`,'PUT',{progress:50,font:22,theme:'dark'}); assert.equal(progress.status,200);
    assert.equal((await me(`books/${b.id}/progress`,'PUT',{progress:60,font:22})).status,400);
    const updated=await me(`books/${b.id}/progress`,'PUT',{progress:60,font:22,revision:progress.data.revision}); assert.equal(updated.status,200);
    assert.equal((await me(`books/${b.id}/progress`,'PUT',{progress:70,font:22,revision:progress.data.revision})).status,409);
    const deleted=await me(`records/books/${b.id}/trash`,'POST',{revision:b.revision}); assert.equal(deleted.status,200);
    assert.equal((await me(`books/${b.id}/content`)).status,404);
    assert.equal((await me('records/books?trash=true')).data.length,1);
    assert.equal((await me(`records/books/${b.id}/restore`,'POST',{revision:deleted.data.revision})).status,200);
    assert.equal((await me('notebook')).data.reading[b.id].progress,60);
    const beforeRename=(await me('records/books')).data.find(book=>book.id===b.id);
    const renamed=await me(`records/books/${b.id}`,'PUT',{...beforeRename,title:'Renamed volume in PostgreSQL'});
    assert.equal(renamed.status,200);
    assert.equal((await pool.query('SELECT title FROM books WHERE id=$1',[b.id])).rows[0].title,'Renamed volume in PostgreSQL');
    assert.equal((await me(`books/${b.id}/content`)).data.text,'Text');
    assert.equal((await me('notebook')).data.reading[b.id].progress,60);
    assert.equal((await me(`records/books/${b.id}`,'PUT',{...beforeRename,title:'Stale name'})).status,409);
    const location=(await me('notebook')).data.reading[b.id];
    const precise={...location,fontFamily:'verdana',anchor:{offset:2,y:0.15,ratio:0.3},alignment:'justify',speech:{voiceURI:'local-en',rate:1.25,follow:false}};
    assert.equal((await me(`books/${b.id}/progress`,'PUT',precise)).status,200);
    const reopened=(await me('notebook')).data.reading[b.id];
    assert.equal(reopened.fontFamily,'verdana');assert.deepEqual(reopened.anchor,precise.anchor);
    assert.equal(reopened.alignment,'justify');assert.deepEqual(reopened.speech,precise.speech);
    assert.equal((await me(`books/${b.id}/progress`,'PUT',{...reopened,fontFamily:'not-a-font'})).status,400);
    assert.equal((await me(`books/${b.id}/progress`,'PUT',{...reopened,anchor:{offset:-1}})).status,400);
    assert.equal((await me(`books/${b.id}/progress`,'PUT',{...reopened,alignment:'random'})).status,400);
    assert.equal((await me(`books/${b.id}/progress`,'PUT',{...reopened,speech:{rate:3}})).status,400);
  });
  await test('export and profile round trips omit identity secrets',async()=>{
    const profile=(await me('notebook')).data.profile;
    assert.equal((await me('profile','PUT',{...profile,name:'My corner',is_public:true})).status,200);
    const visible=(await request('/api/public/notebook')).data.profile;
    assert.equal(visible.name,'My corner'); assert.equal(visible.password_hash,undefined);
    const exported=await me('export'); assert.equal(exported.status,200);
    assert.equal(exported.data.books.length,2); assert.equal(exported.data.notebook.profile.musicUrl,backup.notebook.profile.musicUrl);
    assert.equal(exported.data.sessions,undefined);
  });
  await test('series folders, binary originals, exact bookmarks and owner isolation',async()=>{
    const folder=(await me('folders','POST',{title:'A serial novel'})).data;
    assert.ok(folder.id);
    const renamed=await me(`folders/${folder.id}`,'PUT',{title:'A serial novel — volumes',revision:folder.revision});
    assert.equal(renamed.status,200);
    assert.equal((await me(`folders/${folder.id}`,'PUT',{title:'Stale',revision:folder.revision})).status,409);
    async function upload(bytes,format,auth=cookie) {
      const res=await fetch(base+'/api/me/books/upload?'+new URLSearchParams({title:`Volume ${format}`,format,folderId:folder.id}),{method:'POST',headers:{Cookie:auth,Origin:config.origin,'Content-Type':format==='pdf'?'application/pdf':'application/epub+zip'},body:bytes});
      return {status:res.status,data:await res.json()};
    }
    assert.equal((await upload(samplePDF(),'pdf','')).status,401);
    assert.equal((await upload(samplePDF(),'pdf',cookie2)).status,404);
    assert.equal((await upload(Buffer.from('not a pdf'),'pdf')).status,400);
    assert.equal((await upload(Buffer.from('not an epub'),'epub')).status,400);
    const pdf=await upload(samplePDF(),'pdf'),epub=await upload(sampleEPUB(),'epub');
    assert.equal(pdf.status,201);assert.equal(epub.status,201);
    assert.equal(pdf.data.folderId,folder.id);
    const file=await fetch(base+`/api/me/books/${epub.data.id}/file`,{headers:{Cookie:cookie}});
    assert.equal(file.status,200);assert.equal(file.headers.get('content-type'),'application/epub+zip');
    assert.deepEqual(Buffer.from(await file.arrayBuffer()),sampleEPUB());
    assert.equal((await request(`/api/me/books/${pdf.data.id}/file`,{cookie:cookie2})).status,404);
    assert.equal((await request(`/api/me/books/${pdf.data.id}/file`)).status,401);
    const progress=await me(`books/${pdf.data.id}/progress`,'PUT',{progress:100,font:20,theme:'dark',locator:'pdf:2'});
    assert.equal(progress.status,200);assert.equal((await me('notebook')).data.reading[pdf.data.id].locator,'pdf:2');
    assert.equal((await me(`records/books/${pdf.data.id}`,'PUT',{...pdf.data,format:'txt'})).status,400);
    assert.equal((await request(`/api/me/folders/${folder.id}/remove`,{method:'POST',cookie:cookie2,body:{revision:renamed.data.revision}})).status,409);
    const exported=(await me('export')).data;
    assert.ok(exported.books.find(b=>b.id===pdf.data.id).base64);
    assert.equal(exported.folders[0].title,'A serial novel — volumes');
    const restoredOwner=await createOwner(pool,'restored','a restored owner password');
    const restoredLogin=await request('/api/auth/login',{method:'POST',body:{login:'restored',password:'a restored owner password'}});
    const restoredCookie=restoredLogin.headers.get('set-cookie').split(';')[0];
    const preview=await request('/api/me/import/preview',{method:'POST',cookie:restoredCookie,body:{source:'new-library',backup:exported}});
    assert.equal(preview.status,200);
    const committed=await request('/api/me/import/commit',{method:'POST',cookie:restoredCookie,body:{backup:exported,token:preview.data.token}});
    assert.equal(committed.status,200);
    const restoredBooks=(await request('/api/me/records/books',{cookie:restoredCookie})).data;
    const restoredPDF=restoredBooks.find(b=>b.format==='pdf');
    const restoredText=restoredBooks.find(b=>b.title==='Renamed volume in PostgreSQL');
    const restoredPreferences=(await request('/api/me/notebook',{cookie:restoredCookie})).data.reading[restoredText.id];
    assert.equal(restoredPreferences.alignment,'justify');assert.equal(restoredPreferences.speech.rate,1.25);
    assert.notEqual(restoredPDF.folderId,folder.id);assert.ok(restoredPDF.folderId);
    const restoredFile=await fetch(base+`/api/me/books/${restoredPDF.id}/file`,{headers:{Cookie:restoredCookie}});
    assert.deepEqual(Buffer.from(await restoredFile.arrayBuffer()),samplePDF());
    assert.equal((await request('/api/me/notebook',{cookie:restoredCookie})).data.reading[restoredPDF.id].locator,'pdf:2');
    assert.equal((await me(`folders/${folder.id}/remove`,'POST',{revision:renamed.data.revision})).status,200);
    assert.equal((await me('records/books')).data.find(b=>b.id===pdf.data.id).folderId,null);
    assert.equal((await me('notebook')).data.reading[pdf.data.id].locator,'pdf:2');
    assert.equal((await request('/api/public/notebook')).data.books,undefined);
  });
  await test('logout revokes the server session',async()=>{
    assert.equal((await request('/api/auth/logout',{method:'POST',body:{},cookie})).status,200);
    assert.equal((await me('notebook')).status,401);
    assert.equal((await request('/api/auth/session',{cookie})).data.authenticated,false);
  });
  if (embedded) await test('restricted runtime grants support actual requests without schema-owner access',async()=>{
    const role='runtime_test';
    await pool.query(`CREATE ROLE ${role} NOLOGIN`);
    const dbName=(await pool.query('SELECT current_database() AS name')).rows[0].name;
    const grants=(await readFile(new URL('../server/grants.sql',import.meta.url),'utf8')).replaceAll('picturebook_app',role).replace('ON DATABASE picturebook',`ON DATABASE "${dbName.replaceAll('"','""')}"`);
    await pool.query(grants);
    await pool.query(`SET ROLE ${role}`);
    try {
      await assert.rejects(()=>pool.query('CREATE TABLE forbidden_table(id integer)'),e=>e.code==='42501');
      await assert.rejects(()=>pool.query('UPDATE accounts SET password_hash=$1 WHERE id=$2',['forbidden',owner]),e=>e.code==='42501');
      const fresh=await request('/api/auth/login',{method:'POST',body:{login:'other',password:'another private password'}});
      assert.equal(fresh.status,200);
      const restrictedCookie=fresh.headers.get('set-cookie').split(';')[0];
      const preview=await request('/api/me/import/preview',{method:'POST',body:{source:'runtime-import',backup},cookie:restrictedCookie});
      assert.equal(preview.status,200);
      assert.equal((await request('/api/me/import/commit',{method:'POST',body:{backup,token:preview.data.token},cookie:restrictedCookie})).status,200);
      assert.equal((await request('/api/me/export',{cookie:restrictedCookie})).status,200);
      const folder=await request('/api/me/folders',{method:'POST',cookie:restrictedCookie,body:{title:'Restricted-role series'}});
      assert.equal(folder.status,201);
      const upload=await fetch(base+'/api/me/books/upload?'+new URLSearchParams({title:'Runtime PDF',format:'pdf',folderId:folder.data.id}),{method:'POST',headers:{Cookie:restrictedCookie,Origin:config.origin,'Content-Type':'application/pdf'},body:samplePDF()});
      assert.equal(upload.status,201);
    } finally { await pool.query('RESET ROLE'); }
  });
  console.log(`${checks} database/API integration scenarios passed (${embedded?'embedded PostgreSQL':'native PostgreSQL'}).`);
} catch (error) { console.error(error.message); console.error(error.stack?.split('\n').slice(1,4).join('\n')); process.exitCode=1; }
finally {
  if (server) await new Promise(resolve=>server.close(resolve));
  if (embedded) await embedded.close(); else await pool.end();
}
