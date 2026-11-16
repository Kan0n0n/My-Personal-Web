import {session,login,logout,cookie,createLoginLimiter} from './auth.mjs';
import {HttpError,fail,plain,descriptor} from './model.mjs';
import * as store from './store.mjs';
import {importService} from './import.mjs';
import {transaction} from './db.mjs';
import {MAX_BOOK_BYTES} from './book-files.mjs';

export function json(res,status,data,headers={}) {
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});
  res.end(JSON.stringify(data));
}
export async function readBody(req,max) {
  if (Number(req.headers['content-length'])>max) fail('Request is too large.',413);
  const chunks=[]; let bytes=0;
  for await (const chunk of req) { bytes+=chunk.length; if (bytes>max) fail('Request is too large.',413); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
export async function readJSON(req,max=2*1024*1024) {
  if ((req.headers['content-type']??'').split(';',1)[0].trim().toLowerCase()!=='application/json') fail('Use application/json.',415);
  const bytes=await readBody(req,max);
  try { const value=JSON.parse(bytes.toString('utf8')); if (!plain(value)) fail('Expected a JSON object.'); return value; }
  catch (error) { if (error instanceof HttpError) throw error; fail('Invalid JSON.'); }
}
export async function music(req,res,url,fetcher=fetch) {
  if (req.method!=='GET') return json(res,405,{error:'Use a GET request.'},{Allow:'GET'});
  const videoId=url.searchParams.get('videoId');
  if (!videoId||!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return json(res,400,{error:'A valid YouTube video ID is required.'});
  const endpoint=new URL('https://www.youtube.com/oembed');
  endpoint.searchParams.set('url',`https://www.youtube.com/watch?v=${videoId}`); endpoint.searchParams.set('format','json');
  try {
    const response=await fetcher(endpoint,{signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw Error('Unavailable');
    const data=await response.json();
    if (['title','author_name','thumbnail_url'].some(k=>typeof data[k]!=='string'||!data[k])) throw Error('Invalid metadata');
    return json(res,200,{title:data.title,author_name:data.author_name,thumbnail_url:data.thumbnail_url});
  } catch { return json(res,502,{error:'Could not retrieve video information. Try another link.'}); }
}
export function createAPI(pool,config) {
  const imports=importService(pool,config.importSecret), limitLogin=createLoginLimiter();
  const secure=new URL(config.origin).protocol==='https:';
  return async (req,res,url)=>{
    try {
      if (!['GET','POST','PUT'].includes(req.method)) fail('Method not allowed.',405);
      if (req.method!=='GET') {
        if (req.headers.origin!==config.origin) fail('This request must come from the configured site origin.',403);
        if (req.headers['sec-fetch-site']==='cross-site') fail('Cross-site request rejected.',403);
      }
      const path=url.pathname;
      if (path==='/api/music-info') return await music(req,res,url);
      if (path==='/api/auth/login'&&req.method==='POST') {
        limitLogin(req.socket.remoteAddress);
        const body=await readJSON(req,4096), token=await login(pool,body.login,body.password,config.sessionDays);
        return json(res,200,{ok:true},{'Set-Cookie':cookie(token,secure,config.sessionDays*86400)});
      }
      const user=await session(pool,req);
      if (path==='/api/auth/session'&&req.method==='GET') return json(res,200,{authenticated:!!user,login:user?.login_name??null});
      if (path==='/api/auth/logout'&&req.method==='POST') { await logout(pool,req); return json(res,200,{ok:true},{'Set-Cookie':cookie('',secure,0)}); }
      if (path==='/api/public/notebook'&&req.method==='GET') {
        const owner=(await pool.query('SELECT id FROM accounts WHERE login_name=$1 AND disabled_at IS NULL',[config.ownerLogin])).rows[0];
        return json(res,200,await store.notebook(pool,owner?.id,true));
      }
      if (!path.startsWith('/api/me/')) fail('API route not found.',404);
      if (!user) fail('Sign in to use your private notebook.',401);
      const owner=user.id;
      if (path==='/api/me/books/upload'&&req.method==='POST') {
        if (!['application/pdf','application/epub+zip'].includes(req.headers['content-type'])) fail('Upload a PDF or EPUB file.');
        const bytes=await readBody(req,MAX_BOOK_BYTES);
        const format=url.searchParams.get('format');
        if (req.headers['content-type']!==(format==='pdf'?'application/pdf':'application/epub+zip')) fail('File type does not match its format.');
        return json(res,201,await store.uploadBook(pool,owner,{title:url.searchParams.get('title'),format,sourcePath:url.searchParams.get('sourcePath')??'',folderId:url.searchParams.get('folderId')||null},bytes));
      }
      const folder=path.match(/^\/api\/me\/folders(?:\/([^/]+)(?:\/(remove))?)?$/);
      if (folder) {
        const [,id,action]=folder;
        if (!id&&req.method==='GET') return json(res,200,await store.folders(pool,owner));
        if (req.method==='POST'&&action==='remove') return json(res,200,await store.removeFolder(pool,owner,id,await readJSON(req)));
        if ((!id&&req.method==='POST')||(id&&!action&&req.method==='PUT')) return json(res,id?200:201,await store.saveFolder(pool,owner,id,await readJSON(req)));
        fail('Method not allowed.',405);
      }
      if (path==='/api/me/notebook'&&req.method==='GET') return json(res,200,await transaction(pool,async c=>{
        await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ'); return store.notebook(c,owner);
      }));
      if (path==='/api/me/profile'&&req.method==='PUT') return json(res,200,await store.updateProfile(pool,owner,await readJSON(req)));
      if (path==='/api/me/export'&&req.method==='GET') return json(res,200,await store.exportBackup(pool,owner));
      if (path==='/api/me/import/preview'&&req.method==='POST') {
        const b=await readJSON(req,64*1024*1024); return json(res,200,imports.preview(owner,b.source,b.backup));
      }
      if (path==='/api/me/import/commit'&&req.method==='POST') {
        const b=await readJSON(req,64*1024*1024); return json(res,200,await imports.commit(owner,b.backup,b.token));
      }
      const book=path.match(/^\/api\/me\/books\/([^/]+)\/(content|progress|file)$/);
      if (book) {
        if (book[2]==='file'&&req.method==='GET') {
          const file=await store.bookFile(pool,owner,book[1]);
          res.writeHead(200,{'Content-Type':file.format==='pdf'?'application/pdf':'application/epub+zip','Content-Length':file.bytes.length,'Content-Disposition':`attachment; filename="book.${file.format}"`,'Cache-Control':'no-store','Content-Security-Policy':"sandbox; default-src 'none'"});
          res.end(file.bytes); return;
        }
        if (book[2]==='content'&&req.method==='GET') return json(res,200,await store.content(pool,owner,book[1]));
        if (book[2]==='progress'&&req.method==='PUT') return json(res,200,await store.progress(pool,owner,book[1],await readJSON(req)));
        fail('Method not allowed.',405);
      }
      const match=path.match(/^\/api\/me\/records\/([a-z]+)(?:\/([^/]+)(?:\/(trash|restore|publish|unpublish))?)?$/);
      if (match) {
        const [,key,id,action]=match; descriptor(key);
        if (!id&&req.method==='GET') {
          const limit=Number(url.searchParams.get('limit')??500),offset=Number(url.searchParams.get('offset')??0);
          if (!Number.isInteger(limit)||limit<1||limit>500||!Number.isInteger(offset)||offset<0) fail('Invalid pagination.');
          return json(res,200,await store.list(pool,owner,key,{trash:url.searchParams.get('trash')==='true',limit,offset}));
        }
        const body=await readJSON(req,key==='books'?12*1024*1024:2*1024*1024);
        if (!id&&req.method==='POST') return json(res,201,await store.createRecord(pool,owner,key,body));
        if (id&&!action&&req.method==='PUT') return json(res,200,await store.updateRecord(pool,owner,key,id,body));
        if (id&&action&&req.method==='POST') return json(res,200,await store.recordAction(pool,owner,key,id,action,body));
        fail('Method not allowed.',405);
      }
      fail('API route not found.',404);
    } catch (error) {
      if (error instanceof HttpError) return json(res,error.status,{error:error.message});
      if (['23505','23503','23514','22007','22008','22P02'].includes(error.code)) return json(res,409,{error:'The record violates a data constraint. Reload and review your input.'});
      // Do not put SQL, credentials, or private records in HTTP errors or logs.
      console.error('Database/API operation failed.',error.code??error.name);
      return json(res,503,{error:'The database is unavailable or the request could not be completed. No save was confirmed.'});
    }
  };
}
