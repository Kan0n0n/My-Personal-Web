import {checkBookFile} from './book-files.mjs';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const fail = (message, status = 400) => { throw new HttpError(status, message); };
export const plain = value => value && typeof value === 'object' && !Array.isArray(value);
function text(value, field, required = false, max = 1000000) {
  if (typeof value !== 'string' || value.includes('\0') || value.length > max || (required && !value.trim())) fail(`Invalid ${field}.`);
  return value;
}
function date(value, field, optional = false) {
  if (optional && (value === '' || value == null)) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01' || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) fail(`Invalid ${field}.`);
  return value;
}
function number(value, field, min, max, integral = true) {
  if (!['string','number'].includes(typeof value) || String(value).trim()==='' || !Number.isFinite(Number(value)) || Number(value)<min || Number(value)>max || (integral && !Number.isInteger(Number(value)))) fail(`Invalid ${field}.`);
  return Number(value);
}
function bool(value, field) { if (typeof value !== 'boolean') fail(`Invalid ${field}.`); return value; }
function choice(value, field, values) { if (!values.includes(value)) fail(`Invalid ${field}.`); return value; }
function url(value, field, optional = false) {
  if (optional && value === '') return '';
  text(value, field, true, 4096);
  try { const u = new URL(value); if (!['http:','https:'].includes(u.protocol) || u.username || u.password) fail(`Invalid ${field}.`); }
  catch { fail(`Invalid ${field}; use an HTTP(S) URL.`); }
  return value;
}
const t = (v,f) => text(v,f,false);
const title = (v,f) => text(v,f,true,500);
const day = (v,f) => date(v,f);
const tasks = {'To do':'todo','In progress':'in_progress','Done':'done'};
const anime = {'Watching':'watching','Completed':'completed','On hold':'on_hold','Plan to watch':'planned'};
const mapped = map => (v,f) => { if (typeof v!=='string'||!Object.hasOwn(map,v)) fail(`Invalid ${f}.`); return map[v]; };
// SQL identifiers come exclusively from these trusted descriptors.
export const collections = {
  posts: {table:'entries', fixed:{kind:'note'}, fields:{title:['title',title], date:['entry_date',day], body:['body',(v,f)=>text(v,f,true)], tags:['tags_text',t,'']}, publish:true},
  blogs: {table:'entries', fields:{title:['title',title], date:['entry_date',day], body:['body',(v,f)=>text(v,f,true)], tags:['tags_text',t,''], category:['kind',mapped({Blog:'blog',Story:'story'})]}, publish:true},
  tasks: {table:'tasks', fields:{title:['title',title], note:['note',t,''], due:['due_date',(v,f)=>date(v,f,true),''], status:['status',mapped(tasks)]}},
  documents: {table:'resource_links', fields:{title:['title',title], url:['url',url], folder:['folder_label',t,''], note:['note',t,'']}},
  anime: {table:'anime_logs', fields:{title:['title',title], date:['log_date',day], status:['watch_status',mapped(anime)], rating:['rating',(v,f)=>v==null||v===''?null:number(v,f,1,5),null], episodes:['episodes_watched',(v,f)=>number(v,f,0,2147483647),0], body:['thoughts',t,''], spoilers:['spoilers',bool,false]}, publish:true},
  events: {table:'reminders', fields:{title:['title',title], date:['reminder_date',day]}},
  books: {table:'books', fields:{title:['title',title], sourcePath:['source_path',(v,f)=>text(v,f,false,4096),''], format:['format',(v,f)=>choice(v,f,['txt','md','pdf','epub'])], folderId:['folder_id',v=>v==null||v===''?null:uuid(v),null]}}
};
export const profileFields = {
  name:['display_name',title], bio:['bio',t,''], status:['status',t,''], intro:['intro',t,''],
  watching:['currently_watching',t,''], playing:['currently_playing',t,''], doing:['currently_doing',t,''],
  song:['song_title',t,''], artist:['song_artist',t,''], musicCover:['music_cover_url',(v,f)=>url(v,f,true),''], musicUrl:['music_url',(v,f)=>url(v,f,true),''],
  is_public:['is_public',bool,false]
};
export function descriptor(key) { if (!Object.hasOwn(collections,key)) fail('Unknown collection.',404); return collections[key]; }
export function validateFields(fields, data, prefix = '') {
  if (!plain(data)) fail('Expected an object.');
  return Object.fromEntries(Object.entries(fields).map(([name,[column,validate,fallback]]) => [column,validate(data[name] ?? fallback, prefix+name)]));
}
export function validateRecord(key, data) {
  const d = descriptor(key);
  const allowed = [...Object.keys(d.fields),'id','revision','publication_state','published_at','text'];
  if (!plain(data) || Object.keys(data).some(k=>!allowed.includes(k))) fail(`Unknown or invalid field in ${key}.`);
  return {...validateFields(d.fields,data,key+'.'),...d.fixed};
}
export function validateProfile(data) {
  if (!plain(data) || Object.keys(data).some(k=>![...Object.keys(profileFields),'revision'].includes(k))) fail('Unknown profile field.');
  return validateFields(profileFields,data,'profile.');
}
export function encode(fields,row) {
  return Object.fromEntries(Object.entries(fields).map(([name,[column]])=>[name,row[column]]));
}
export function encodeRecord(key,row,publicRead=false) {
  const d=descriptor(key), result={id:row.id,...encode(d.fields,row)};
  if (key==='blogs') result.category=row.kind==='story'?'Story':'Blog';
  if (key==='tasks') result.status=Object.keys(tasks).find(x=>tasks[x]===row.status);
  if (key==='anime') result.status=Object.keys(anime).find(x=>anime[x]===row.watch_status);
  if (!publicRead) {
    result.revision=Number(row.revision);
    if (d.publish) result.publication_state=row.publication_state;
  }
  return result;
}
export function revision(value) { return number(value,'revision',1,Number.MAX_SAFE_INTEGER); }
export function uuid(value) { if (typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) fail('Invalid record ID.'); return value; }
export function validateProgress(data) {
  if (!plain(data) || Object.keys(data).some(k=>!['progress','font','theme','revision','locator','fontFamily','anchor','alignment','speech'].includes(k))) fail('Invalid reading position.');
  const anchor=data.anchor??{};
  if(!plain(anchor)||Object.keys(anchor).some(k=>!['offset','y','ratio'].includes(k)))fail('Invalid reading anchor.');
  const checked={};
  if(anchor.offset!==undefined)checked.offset=number(anchor.offset,'anchor offset',0,10485760);
  if(anchor.y!==undefined)checked.y=number(anchor.y,'anchor screen position',-2,2,false);
  if(anchor.ratio!==undefined)checked.ratio=number(anchor.ratio,'anchor scroll ratio',0,1,false);
  const speech=data.speech??{};
  if(!plain(speech)||Object.keys(speech).some(k=>!['voiceURI','rate','follow'].includes(k)))fail('Invalid speech preferences.');
  const settings={voiceURI:text(speech.voiceURI??'','voice',false,1000),rate:number(speech.rate??1,'speech rate',0.5,2,false),follow:bool(speech.follow??true,'follow voice')};
  return {progress_percent:number(data.progress??0,'progress',0,100,false),font_size_px:number(data.font??18,'font',14,30),reader_theme:choice(data.theme??'light','theme',['light','dark']),locator:text(data.locator??'','locator',false,200),reader_font_family:choice(data.fontFamily??'georgia','font family',['georgia','overlock','palatino','arial','verdana','monospace']),view_anchor:JSON.stringify(checked),text_alignment:choice(data.alignment??'left','alignment',['left','center','right','justify']),speech_preferences:JSON.stringify(settings)};
}
export function bookText(value) { text(value,'book text',false,10485760); if (Buffer.byteLength(value,'utf8')>10485760) fail('Book text exceeds 10 MiB.'); return value; }
export function emptyNotebook() { return {version:1,profile:{},posts:[],blogs:[],tasks:[],documents:[],anime:[],events:[],reading:{}}; }

export function validateBackup(data) {
  if (!plain(data)) fail('Invalid backup.');
  if (Object.hasOwn(data,'notebook') && Object.keys(data).some(k=>!['notebook','books','folders'].includes(k))) fail('Unknown backup envelope fields; review the original file.');
  const notebook=data.notebook??data;
  if (!plain(notebook)||notebook.version!==1) fail('Expected a version-1 notebook backup.');
  if (Object.keys(notebook).some(k=>!['version','profile','posts','blogs','tasks','documents','anime','events','reading'].includes(k))) fail('Unknown notebook fields; keep the original backup and review it.');
  const profile=validateProfile(notebook.profile);
  profile.is_public=false;
  const records={}, counts={}, seen={};
  for (const key of Object.keys(collections).filter(k=>k!=='books')) {
    const list=notebook[key]??[];
    if (!Array.isArray(list)||list.length>10000) fail(`Invalid or excessive ${key} records.`);
    seen[key]=new Set();
    records[key]=list.map((r,i)=>{
      if (!plain(r)||typeof r.id!=='string'||!r.id||r.id.length>4096||seen[key].has(r.id)) fail(`Invalid/duplicate ${key} ID at row ${i+1}.`);
      seen[key].add(r.id);
      return {legacyId:r.id,position:i,values:validateRecord(key,r)};
    });
    counts[key]=list.length;
  }
  const list=data.books??[];
  const folderList=data.folders??[];
  if (!Array.isArray(folderList)||folderList.length>10000) fail('Invalid folders.');
  const folderIds=new Set(),folderNames=new Set();
  const folders=folderList.map(f=>{
    if (!plain(f)||Object.keys(f).some(k=>!['id','title','revision'].includes(k))) fail('Invalid folder.');
    uuid(f.id); title(f.title,'folder title');
    if (folderIds.has(f.id)||folderNames.has(f.title.trim())) fail('Duplicate folder.');
    folderIds.add(f.id);folderNames.add(f.title.trim());
    return {id:f.id,title:f.title.trim()};
  });
  if (!Array.isArray(list)||list.length>1000) fail('Invalid or excessive books.');
  const bookIds=new Set();
  records.books=list.map((b,i)=>{
    if (!plain(b)||typeof b.id!=='string'||!b.id||b.id.length>4096||bookIds.has(b.id)) fail(`Invalid/duplicate book ID at row ${i+1}.`);
    if (Object.keys(b).some(k=>!['id','title','text','base64','sourcePath','format','revision','folderId'].includes(k))) fail('Unknown book fields.');
    bookIds.add(b.id);
    const format=b.format??(/\.md$/i.test(b.id)?'md':'txt');
    if (b.folderId&&!folderIds.has(b.folderId)) fail('Book has no matching folder.');
    let binary;
    if (['pdf','epub'].includes(format)) {
      if (typeof b.base64!=='string'||b.base64.length>69905068||b.base64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(b.base64)) fail('Invalid binary book backup.');
      binary=checkBookFile(format,Buffer.from(b.base64,'base64'));
    }
    return {legacyId:b.id,position:i,...(binary?{binary}:{text:bookText(b.text)}),values:validateRecord('books',{title:b.title,sourcePath:b.sourcePath??b.id,format,folderId:b.folderId??null})};
  });
  counts.books=list.length;
  if (!plain(notebook.reading??{})) fail('Invalid reading positions.');
  const reading=Object.entries(notebook.reading??{}).map(([id,value])=>{
    if (!bookIds.has(id)) fail(`Bookmark has no matching book: ${id}. Include all IndexedDB books in the backup.`);
    return {legacyId:id,values:validateProgress(value)};
  });
  counts.folders=folders.length;
  return {profile,records,reading,counts,folders};
}
