import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const source=await readFile(new URL('../assets/js/picturebook.js',import.meta.url),'utf8');
const components=await readFile(new URL('../templates/components.html',import.meta.url),'utf8');
const templates=new Map(Array.from(components.matchAll(/<template id="([^"]+)">([\s\S]*?)<\/template>/g),m=>[m[1],m[2]]));
const routes=['index','posts','blog','documents','work','utilities','anime','novels','archive'];
let checks=0;
function checkTags(html,file) {
  const stack=[];
  for (const m of html.replace(/<!--[\s\S]*?-->/g,'').matchAll(/<(\/?)([a-z][\w-]*)\b[^>]*>/gi)) {
    const tag=m[2].toLowerCase(); if (/^(meta|link|img|input|br|hr|source)$/.test(tag)) continue;
    if (m[1]) assert.equal(stack.pop(),tag,`${file}: balanced ${tag}`); else stack.push(tag);
  }
  assert.equal(stack.length,0,`${file}: tags closed`);
}
class ElementStub {
  constructor() {
    this.children=[];this.dataset={};this.style={setProperty(){}};this.textContent='';this.value='';this.selectors=new Map();this.groups=new Map();this.classes=new Set();
    this.classList={toggle:(n,on)=>on?this.classes.add(n):this.classes.delete(n),contains:n=>this.classes.has(n)};
    this.elements={namedItem:n=>this.querySelector('input:'+n)};
  }
  querySelector(s) {if(!this.selectors.has(s))this.selectors.set(s,new ElementStub());return this.selectors.get(s);}
  querySelectorAll(s) {return this.groups.get(s)||[];}
  replaceChildren(...c) {this.children=c;}
  append(...c) {this.children.push(...c);}
  setAttribute(n,v) {this[n]=v;}
  getAttribute(n) {return this[n]??null;}
  showModal() {this.open=true;}
  close() {this.open=false;}
  cloneNode() {return new ElementStub();}
  get firstElementChild() {return this.children[0];}
}
function component(id) {
  assert.ok(templates.has(id),id);const root=new ElementStub(),fields=[];
  for (const m of templates.get(id).matchAll(/data-field="([^"]+)"/g)) {
    const e=new ElementStub();e.dataset.field=m[1];root.selectors.set(`[data-field="${m[1]}"]`,e);fields.push(e);
  }
  root.groups.set('[data-field]',fields);return root;
}
function sandbox(route='posts') {
  const document=new ElementStub();document.body=new ElementStub();document.body.dataset.page=route;document.addEventListener=()=>{};document.createElement=()=>new ElementStub();
  document.getElementById=id=>templates.has(id)?{content:{firstElementChild:{cloneNode:()=>component(id)}}}:null;
  const requests=[],context=vm.createContext({document,window:{},location:{href:'http://127.0.0.1:4173/pages/'+route+'.html'},
    localStorage:{getItem(){throw Error('Unexpected legacy storage read');},setItem(){throw Error('Unexpected browser write');}},
    structuredClone,crypto:webcrypto,URL,URLSearchParams,Blob,AbortSignal,setInterval(){},setTimeout(){},clearTimeout(){},navigator:{},
    FormData:class{constructor(form){return form.testData;}},
    fetch:async(path,options={})=>{requests.push({path,...options});return {ok:true,json:async()=>({})};}
  });
  vm.runInContext(source.replace(/\ninit\(\);\s*$/,'\n'),context);
  return {context,document,requests,run:code=>vm.runInContext(code,context)};
}
const required={index:['starter-note','home-posts','music-cover','music-url','music-load','music-listen','audio-status','weather'],posts:['entry-search','entries'],blog:['entry-search','entry-filter','entries'],documents:['doc-search','documents'],work:[],utilities:['choices','pick-result','count-text','count-result'],anime:['anime-search','anime-filter','anime-list'],novels:['novel-folder','novel-files','book-search','book-list','reader'],archive:['timeline']};
for (const route of [...routes,'ultilities']) {
  const file=new URL(`../pages/${route}.html`,import.meta.url),html=await readFile(file,'utf8');checkTags(html,route);
  assert.match(html,/<header\b/);assert.match(html,/<main\b[\s\S]+<\/main>/);
  if(route!=='ultilities') {
    for(const id of ['main','calendar','editor','toast',...required[route]])assert.ok(html.includes(`id="${id}"`),`${route}: ${id}`);
    assert.doesNotMatch(html,/data-action="login"|href="(?:\.\/)?owner\.html"/);
    assert.match(html,/data-owner-only/);assert.match(html,/data-action="trash"/);sandbox(route).run('refreshPage()');
    for (const button of html.matchAll(/<button\b[^>]*data-action="(?:profile|new-post|new-blog|new-anime|new-task|new-document|backup|trash|logout)"[^>]*>/g)) {
      assert.match(button[0],/\bhidden\b/); assert.match(button[0],/\bdata-owner-only\b/);
    }
  }
  for(const m of html.matchAll(/(?:src|href)="([^"#]+)"/g))if(!/^https?:/.test(m[1]))await access(new URL(m[1],file));
  checks++;
}
checkTags(components,'templates');assert.equal(templates.size,Array.from(components.matchAll(/<template id=/g)).length);checks++;
for(const m of source.matchAll(/cloneTemplate\('([^']+)'\)/g))assert.ok(templates.has(m[1]));checks++;
assert.ok(!/innerHTML|insertAdjacentHTML|localStorage\.setItem|store\.put\(/.test(source));checks++;
for(const name of ['site','responsive','animations','legacy-tool']) {
  const file=new URL(`../assets/css/${name}.css`,import.meta.url),css=await readFile(file,'utf8');
  for(const m of css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g))await access(new URL(m[1],file));
}checks++;
const app=sandbox();
assert.throws(()=>app.run('editEntry("posts")'),/Sign in/);checks++;
app.run('authenticated=true; refreshPage=()=>{}');
let serverRecord;
app.context.fetch=async(path,options)=>{
  app.requests.push({path,...options});const data=JSON.parse(options.body);
  serverRecord={...data,id:serverRecord?.id??webcrypto.randomUUID(),revision:(serverRecord?.revision??0)+1,publication_state:'draft'};
  return {ok:true,json:async()=>serverRecord};
};
app.run('editEntry("posts")');
let form=app.document.querySelector('#editor').firstElementChild;
form.testData=[['title','Memory'],['date','2026-11-06'],['body','Hello'],['tags','test']];
await form.onsubmit({preventDefault(){}});
assert.equal(app.requests[0].path,'/api/me/records/posts');assert.equal(app.requests[0].method,'POST');assert.equal(app.run('state.posts[0].title'),'Memory');checks++;
app.context.testId=serverRecord.id;app.run('editEntry("posts",testId)');form=app.document.querySelector('#editor').firstElementChild;
form.testData=[['title','Edited'],['date','2026-11-06'],['body','<img onerror=alert(1)>'],['tags','test']];
await form.onsubmit({preventDefault(){}});
assert.equal(JSON.parse(app.requests[1].body).revision,1);assert.equal(app.run('state.posts[0].revision'),2);checks++;
const card=app.run('entryCard(state.posts[0],"posts",true)');assert.equal(card.querySelector('[data-field="body"]').textContent,'<img onerror=alert(1)>');checks++;
app.context.fetch=async()=>({ok:false,json:async()=>({error:'Conflict: reload and review'})});
app.run('editEntry("posts",testId)');form=app.document.querySelector('#editor').firstElementChild;
form.testData=[['title','Unsaved edit'],['date','2026-11-06'],['body','Text'],['tags','']];
await form.onsubmit({preventDefault(){}});
assert.equal(app.document.querySelector('#editor').open,true);assert.equal(app.run('state.posts[0].title'),'Edited');assert.match(app.document.querySelector('#toast').textContent,/Conflict/);checks++;
const profile=sandbox('index');profile.run('authenticated=true;state.profile.revision=1;');
profile.context.fetch=async(path,options)=>({ok:true,json:async()=>({...JSON.parse(options.body),revision:2})});
profile.context.metadata={title:'A song',author_name:'Artist',thumbnail_url:'https://example.com/a.jpg'};
await profile.run('displayMusic(metadata,"M7lc1UVf-VE")');assert.equal(profile.run('state.profile.musicUrl'),'https://www.youtube.com/watch?v=M7lc1UVf-VE');checks++;
profile.context.fetch=async()=>({ok:false,json:async()=>({error:'Database unavailable'})});
await assert.rejects(()=>profile.run('displayMusic({...metadata,title:"Unsaved"},"M7lc1UVf-VE")'),/Database unavailable/);
assert.equal(profile.run('state.profile.song'),'A song');checks++;
const bootstrap=sandbox();bootstrap.context.fetch=async path=>({ok:true,json:async()=>path.includes('session')?{authenticated:false}:{version:1,profile:{name:'Public'},posts:[],blogs:[],tasks:[],documents:[],anime:[],events:[],reading:{}}});
await bootstrap.run('loadNotebook()');assert.equal(bootstrap.run('state.profile.name'),'Public');assert.equal(bootstrap.run('authenticated'),false);checks++;
const visitorMusic=sandbox('index');
visitorMusic.context.fetch=async path=>({ok:true,json:async()=>path.includes('session')?{authenticated:false}:{version:1,profile:{song:'Public soundtrack',artist:'Selected artist',musicCover:'https://i.ytimg.com/song.jpg',musicUrl:'https://www.youtube.com/watch?v=M7lc1UVf-VE'},posts:[],blogs:[],tasks:[],documents:[],anime:[],events:[],reading:{}}});
await visitorMusic.run('loadNotebook()');
visitorMusic.run('applyProfile()');
assert.equal(visitorMusic.run('authenticated'),false);
assert.equal(visitorMusic.run('state.profile.song'),'Public soundtrack');
assert.equal(visitorMusic.document.querySelector('#music-listen').hidden,false);
assert.equal(visitorMusic.document.querySelector('#music-listen').href,'https://www.youtube.com/watch?v=M7lc1UVf-VE');checks++;
assert.equal(app.run('safeURL("javascript:alert(1)")'),'#');checks++;
const musicAccess=sandbox('index');
const musicEditor=new ElementStub();
musicAccess.document.groups.set('[data-owner-only]',[musicEditor]);
musicAccess.run('applyAuthorization()');
assert.equal(musicEditor.hidden,true);
assert.equal(musicAccess.document.body.dataset.owner,'false');
assert.equal(musicAccess.document.querySelector('#music-url').disabled,true);
assert.equal(musicAccess.document.querySelector('#music-load').disabled,true);
musicAccess.document.querySelector('#music-url').value='https://youtu.be/M7lc1UVf-VE';
musicAccess.context.fetch=async path=>({ok:true,json:async()=>path.includes('/auth/session')?{authenticated:true}:path.includes('/auth/login')?{ok:true}:{version:1,profile:{name:'Owner',revision:1},posts:[],blogs:[],tasks:[],documents:[],anime:[],events:[],reading:{}}});
await musicAccess.run('loadNotebook()'); musicAccess.run('refreshPage()');
assert.equal(musicAccess.run('authenticated'),true);
assert.equal(musicEditor.hidden,false);
assert.equal(musicAccess.document.body.dataset.owner,'true');
assert.equal(musicAccess.document.querySelector('#music-url').value,'https://youtu.be/M7lc1UVf-VE');
assert.equal(musicAccess.document.querySelector('#music-load').disabled,false);
checks++;
musicAccess.run('profileOverrides=true;state.profile.musicCover="file:///";state.profile.musicUrl="file:///";applyProfile()');
assert.equal(musicAccess.run('safeURL("file:///")'),'#');
assert.equal(musicAccess.document.querySelector('#music-cover').src,'../assets/images/Philine-P5V6.webp');
assert.equal(musicAccess.document.querySelector('#music-listen').hidden,true);
assert.equal(musicAccess.document.querySelector('#music-listen').href,'#');checks++;
musicAccess.context.fetch=async()=>({ok:false,status:401,json:async()=>({error:'Sign in again.'})});
await assert.rejects(()=>musicAccess.run('apiRequest("/api/me/profile","PUT",{})'),/Sign in again/);
assert.equal(musicAccess.run('authenticated'),false);
assert.equal(musicEditor.hidden,true);
assert.equal(musicAccess.document.querySelector('#music-url').disabled,true);
assert.equal(musicAccess.document.querySelector('#music-load').disabled,true);checks++;
const freshProfile=sandbox('index');
freshProfile.context.fetch=async path=>({ok:true,json:async()=>path.includes('session')?{authenticated:true}:{version:1,profile:{name:'Owner',intro:'',bio:'',watching:'',playing:'',doing:'',song:'',artist:'',revision:1},posts:[],blogs:[],tasks:[],documents:[],anime:[],events:[],reading:{}}});
await freshProfile.run('loadNotebook()');
for (const key of ['intro','bio','watching','playing','doing','song','artist']) assert.ok(freshProfile.run(`state.profile.${key}.trim().length > 0`),key);
assert.equal(freshProfile.run('state.profile.name'),'Owner');checks++;
freshProfile.run('state.profile.musicUrl="https://youtu.be/M7lc1UVf-VE";state.profile.is_public=false;editInterests()');
const interestForm=freshProfile.document.querySelector('#editor').firstElementChild;
interestForm.testData=[['watching','New show'],['playing','New game'],['doing','Writing']];
let interestRequest;
freshProfile.context.fetch=async(path,options)=>{interestRequest=JSON.parse(options.body);return {ok:true,json:async()=>({...interestRequest,revision:2})};};
await interestForm.onsubmit({preventDefault(){}});
assert.equal(interestRequest.revision,1);assert.equal(interestRequest.is_public,false);
assert.equal(interestRequest.musicUrl,'https://youtu.be/M7lc1UVf-VE');
assert.equal(freshProfile.run('state.profile.watching'),'New show');checks++;
const weather=sandbox('index');
// Real querySelector searches descendants and cannot match the loading root.
weather.run('const realClone=cloneTemplate;cloneTemplate=id=>{const root=realClone(id);if(id==="loading-template")root.querySelector=()=>null;return root;}');
await weather.run('getWeather()');
assert.match(weather.document.querySelector('#weather').firstElementChild.querySelector('[data-field="message"]').textContent,/Choose a city/);checks++;
weather.context.navigator.geolocation={getCurrentPosition:(success,failure)=>failure({code:1})};
await weather.run('getWeather()');
assert.match(weather.document.querySelector('#weather').firstElementChild.querySelector('[data-field="message"]').textContent,/permission was denied/);checks++;
weather.context.navigator.geolocation={getCurrentPosition:success=>success({coords:{latitude:10,longitude:106,accuracy:2500}})};
let forecastCalls=0;
weather.context.fetch=async url=>{
  forecastCalls++; assert.equal(url.origin,'https://api.open-meteo.com');assert.equal(url.searchParams.get('latitude'),'10');
  return {ok:true,json:async()=>({current:{temperature_2m:29.4,weather_code:2}})};
};
await weather.run('getWeather()');
let weatherPanel=weather.document.querySelector('#weather').firstElementChild;
assert.equal(weatherPanel.querySelector('[data-field="temperature"]').textContent,'29°C');
assert.match(weatherPanel.querySelector('[data-field="updated"]').textContent,/3 km accuracy.*updated now/);
assert.equal(forecastCalls,1);checks++;
weather.context.fetch=async()=>({ok:true,json:async()=>({current:null})});
await weather.run('loadWeather(10,106,"Test place")');
assert.match(weather.document.querySelector('#weather').firstElementChild.querySelector('[data-field="message"]').textContent,/incomplete/);checks++;
weather.context.fetch=async url=>url.hostname.startsWith('geocoding-')?{ok:true,json:async()=>({results:[{name:'Test Town',admin1:'Test Region',country:'Test Country',latitude:12,longitude:108}]})}:{ok:true,json:async()=>({current:{temperature_2m:25,weather_code:0,time:'2026-11-06T10:30'}})};
weather.run('chooseWeatherPlace()');
const placeForm=weather.document.querySelector('#editor').firstElementChild;
placeForm.testData=[['place','Test Town']];await placeForm.onsubmit({preventDefault(){}});
const choice=placeForm.querySelector('#weather-matches').children[0];
assert.match(choice.querySelector('[data-field="name"]').textContent,/Test Town, Test Region, Test Country/);
await choice.onclick();
weatherPanel=weather.document.querySelector('#weather').firstElementChild;
assert.match(weatherPanel.querySelector('[data-field="updated"]').textContent,/Test Town.*10:30/);
assert.equal(weather.run('weatherPlace.latitude'),12);checks++;
const ownerHTML=await readFile(new URL('../pages/owner.html',import.meta.url),'utf8');
checkTags(ownerHTML,'owner.html'); assert.match(ownerHTML,/noindex, nofollow/);
const ownerSource=await readFile(new URL('../assets/js/owner.js',import.meta.url),'utf8');
const ownerForm=new ElementStub(),ownerStatus=new ElementStub(); ownerForm.hidden=true;
const ownerRedirects=[];
const ownerContext=vm.createContext({document:{getElementById:id=>id==='owner-login'?ownerForm:ownerStatus},location:{replace:path=>ownerRedirects.push(path)},FormData:class{constructor(){return [['login','owner'],['password','test-only password']];}},fetch:async()=>({ok:true,json:async()=>({authenticated:false})})});
vm.runInContext(ownerSource,ownerContext);
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(ownerForm.hidden,false); assert.equal(ownerRedirects.length,0);
ownerContext.fetch=async()=>({ok:false,json:async()=>({error:'Wrong password'})});
await ownerForm.onsubmit({preventDefault(){}});assert.equal(ownerStatus.textContent,'Wrong password');assert.equal(ownerRedirects.length,0);
ownerContext.fetch=async()=>({ok:true,json:async()=>({ok:true})});
await ownerForm.onsubmit({preventDefault(){}});assert.equal(ownerRedirects[0],'index.html');checks++;
const shelf=sandbox('novels');
const shelfRecords=[
  {id:'ten',title:'Volume 10',format:'pdf',folderId:'series',revision:1},
  {id:'two',title:'Volume 2',format:'epub',folderId:'series',revision:1},
  {id:'loose',title:'Unfiled story',format:'txt',folderId:null,revision:1}
];
shelf.context.fetch=async(path,options={})=>({ok:true,json:async()=>{
  if(options.method==='PUT') {
    const record=JSON.parse(options.body),index=shelfRecords.findIndex(book=>book.id===record.id);
    shelfRecords[index]={...record,revision:record.revision+1};return shelfRecords[index];
  }
  return path.includes('/folders')?[{id:'series',title:'Series',revision:1}]:shelfRecords;
}});
shelf.run('authenticated=true');await shelf.run('loadBooks()');
assert.equal(shelf.document.querySelector('#book-list').children[1].dataset.id,'two');
shelf.run('selectedFolder="series";showShelf()');
assert.deepEqual(shelf.document.querySelector('#book-list').children.map(button=>button.dataset.id),['two','ten']);
assert.equal(shelf.document.querySelector('#rename-folder').disabled,false);checks++;
shelf.run('selectedFolder="unfiled";showShelf()');
assert.equal(shelf.document.querySelector('#book-list').children[0].dataset.id,'loose');
assert.equal(shelf.document.querySelector('#remove-folder').disabled,true);checks++;
shelf.run('selectedFolder="series"');shelf.document.querySelector('#book-search').value='10';shelf.run('showShelf()');
assert.equal(shelf.document.querySelector('#book-list').children.length,1);
assert.equal(shelf.document.querySelector('#book-list').children[0].dataset.id,'ten');checks++;
shelf.run('editBookFolder("two")');
const renameForm=shelf.document.querySelector('#editor').children[0];
renameForm.testData=[['title','My renamed volume'],['folderId','series']];
await renameForm.onsubmit({preventDefault(){}});
assert.equal(shelfRecords.find(book=>book.id==='two').title,'My renamed volume');
assert.equal(shelf.run('books.find(book=>book.id==="two").title'),'My renamed volume');checks++;
const history=JSON.parse(await readFile(new URL('../data/changelog.json',import.meta.url),'utf8'));
for(const entry of history){await access(new URL('../'+entry.notes,import.meta.url));assert.ok(entry.changes.length);}checks++;
console.log(`${checks} frontend/static scenarios passed (DOM stubs, not a browser rendering test).`);
