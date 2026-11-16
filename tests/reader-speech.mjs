import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createSpeechReader} from '../assets/js/reader-speech.mjs';
const templates=await readFile(new URL('../templates/components.html',import.meta.url),'utf8');
const local={voiceURI:'local-en',name:'Device English',lang:'en-US',localService:true,default:true};
const remote={voiceURI:'remote',name:'Online voice',lang:'en-US',localService:false};
let checks=0;
function setup({text='The first sentence. The second sentence.',kind='epub',voices=[local,remote],preferences={},pages=[],highlight=true}={}) {
  const dom=new JSDOM('<main id="reader"></main>'+templates),win=dom.window,doc=win.document,root=doc.querySelector('#reader');root.append(doc.querySelector('#reader-template').content.cloneNode(true));
  const container=root.querySelector('.reader-text');container.textContent=text;
  const spoken=[],saved=[],scrolls=[],changes=[];let index=0,cancels=0,current=true,controller,offset=0;
  const synth=new win.EventTarget();synth.getVoices=()=>voices;synth.speak=utterance=>spoken.push(utterance);synth.cancel=()=>{cancels++;};
  win.speechSynthesis=synth;win.SpeechSynthesisUtterance=class{constructor(value){this.text=value;}};win.scrollTo=value=>scrolls.push(value);
  win.Range.prototype.getBoundingClientRect=()=>({top:900,bottom:920,left:4,right:84,width:80,height:20});win.Range.prototype.getClientRects=function(){return [this.getBoundingClientRect()];};
  if(highlight){win.CSS={highlights:new Map()};win.Highlight=class{constructor(range){this.range=range;}};}
  controller=createSpeechReader({root,container,kind,preferences,getOffset:()=>offset,isCurrent:()=>current,
    nextPage:async()=>{
      if(index>=pages.length)return false;
      root.dispatchEvent(new win.CustomEvent('reader-before-page-change',{detail:{source:'tts'}}));
      container.textContent=pages[index++];root.dispatchEvent(new win.CustomEvent('reader-page-change',{detail:{source:'tts'}}));return true;
    },onPosition:()=>changes.push('position'),flush:()=>saved.push(controller.anchor()),onPreferences:value=>changes.push(value)});
  return {win,root,container,controller,spoken,saved,scrolls,changes,synth,voices,$:selector=>root.querySelector(selector),setOffset:value=>{offset=value;},expire:()=>{current=false;controller.stop('Session expired.',false);},close:()=>{controller.destroy();win.close();},get cancels(){return cancels;}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const basic=setup();assert.equal(basic.spoken.length,0);assert.equal(basic.$('#speech-voice').options.length,1);assert.equal(basic.$('#speech-voice').value,'local-en');checks++;
await basic.$('#speech-play').onclick();assert.match(basic.spoken[0].text,/first sentence/);assert.equal(basic.spoken[0].voice,local);assert.ok(basic.win.CSS.highlights.has('novel-spoken'));checks++;
basic.spoken[0].onboundary({name:'word',charIndex:4,charLength:5});assert.equal(basic.controller.anchor().offset,4);assert.match(basic.$('#speech-status').textContent,/word highlighting/);assert.ok(basic.scrolls.length);checks++;
basic.$('#speech-pause').onclick();assert.equal(basic.$('#speech-pause').textContent,'Resume');assert.equal(basic.saved.at(-1).offset,4);
basic.$('#speech-pause').onclick();await tick();assert.equal(basic.spoken.length,2);checks++;
const stale=basic.spoken.at(-1);basic.$('#speech-stop').onclick();stale.onend();stale.onboundary({name:'word',charIndex:5,charLength:3});await tick();assert.equal(basic.spoken.length,2);assert.equal(basic.controller.anchor(),null);assert.equal(basic.win.CSS.highlights.size,0);basic.close();checks++;
const selected=setup();const selection=selected.win.getSelection(),range=selected.win.document.createRange();range.setStart(selected.container.firstChild,20);range.setEnd(selected.container.firstChild,30);selection.addRange(range);
await selected.$('#speech-play').onclick();assert.match(selected.spoken[0].text,/second sentence/);selected.close();checks++;
const fallback=setup({highlight:false});await fallback.$('#speech-play').onclick();assert.match(fallback.$('#speech-status').textContent,/sentence highlighting/);assert.equal(fallback.$('#speech-highlight-layer').children.length,1);fallback.close();checks++;
const advance=setup({text:'Page one.',pages:['','Page three.']});await advance.$('#speech-play').onclick();advance.spoken[0].onend();await tick();assert.equal(advance.spoken.length,2);assert.equal(advance.spoken[1].text,'Page three.');advance.spoken[1].onend();await tick();assert.match(advance.$('#speech-status').textContent,/Finished this book/);assert.ok(advance.saved.length>=2);advance.close();checks++;
const manual=setup();await manual.$('#speech-play').onclick();const old=manual.spoken[0];manual.root.dispatchEvent(new manual.win.CustomEvent('reader-before-page-change',{detail:{source:'manual'}}));old.onend();await tick();assert.equal(manual.spoken.length,1);assert.equal(manual.controller.anchor(),null);manual.close();checks++;
const noVoices=setup({voices:[remote]});assert.equal(noVoices.$('#speech-play').disabled,true);assert.match(noVoices.$('#speech-status').textContent,/No installed local voices/);noVoices.voices.push(local);noVoices.synth.dispatchEvent(new noVoices.win.Event('voiceschanged'));assert.equal(noVoices.$('#speech-play').disabled,false);noVoices.close();checks++;
const scanned=setup({kind:'pdf',text:''});assert.equal(scanned.$('#speech-play').disabled,true);assert.match(scanned.$('#speech-status').textContent,/Scanned/);scanned.close();checks++;
const prefs=setup({preferences:{voiceURI:local.voiceURI,rate:1.5,follow:false}});await prefs.$('#speech-play').onclick();assert.equal(prefs.spoken[0].rate,1.5);assert.equal(prefs.controller.preferences().follow,false);assert.equal(prefs.scrolls.length,0);prefs.$('#speech-rate').value='0.75';prefs.$('#speech-rate').onchange();await tick();assert.equal(prefs.spoken.at(-1).rate,0.75);prefs.close();checks++;
const failed=setup();await failed.$('#speech-play').onclick();failed.spoken[0].onerror({error:'synthesis-failed'});assert.match(failed.$('#speech-status').textContent,/synthesis-failed/);assert.equal(failed.$('#speech-play').disabled,false);failed.close();checks++;
const expired=setup();await expired.$('#speech-play').onclick();expired.expire();expired.spoken[0].onend();await tick();assert.equal(expired.spoken.length,1);assert.equal(expired.$('#speech-play').disabled,true);expired.close();checks++;
const blocks=setup();blocks.container.replaceChildren();
for(const text of ['First block.','Second block.']){const p=blocks.win.document.createElement('p');p.textContent=text;blocks.container.append(p);}
await blocks.$('#speech-play').onclick();
assert.equal(blocks.win.CSS.highlights.get('novel-spoken').range.toString(),'First block.');blocks.close();checks++;
console.log(`${checks} read-aloud scenarios passed (mock device voices; real audio quality requires browser testing).`);
