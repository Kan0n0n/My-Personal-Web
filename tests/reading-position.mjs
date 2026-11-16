import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createReadingSession,captureAnchor,restoreAnchor} from '../assets/js/reading-position.mjs';
let checks=0;
function harness(writeOverride) {
  let position={locator:'epubpage:1:0',progress:10,font:18,theme:'light',fontFamily:'georgia',anchor:{ratio:0}},rev=0,id=0;
  const writes=[],statuses=[],timers=new Map();
  const session=createReadingSession({capture:()=>structuredClone(position),revision:()=>rev,
    write:async data=>{writes.push(data);await writeOverride?.(data);rev++;},status:message=>statuses.push(message),
    setTimer:fn=>{timers.set(++id,fn);return id;},clearTimer:key=>timers.delete(key)});
  return {session,writes,statuses,timers,set:next=>{position={...position,...next};}};
}
const latest=harness();latest.session.schedule();latest.set({progress:20});latest.session.schedule();
assert.equal(latest.timers.size,1);await latest.session.flush();assert.equal(latest.writes.length,1);assert.equal(latest.writes[0].progress,20);checks++;
const manual=harness();manual.session.schedule();manual.set({progress:30});await manual.session.saveNow();
assert.equal(manual.timers.size,0);assert.equal(manual.writes.at(-1).progress,30);
manual.set({progress:40});await manual.session.flush();assert.equal(manual.writes.at(-1).progress,40);assert.equal(manual.writes.at(-1).revision,1);checks++;
const canceled=harness();const stale=canceled.session.flush();canceled.set({progress:50});await canceled.session.saveNow();await stale;
assert.equal(canceled.writes.length,1);assert.equal(canceled.writes[0].progress,50);checks++;
let release;const gate=new Promise(resolve=>{release=resolve;});
const ordered=harness(async()=>{if(ordered.writes.length===1)await gate;});
const first=ordered.session.flush();await Promise.resolve();await Promise.resolve();
ordered.set({progress:75});const pinned=ordered.session.saveNow();release();await first;await pinned;
assert.deepEqual(ordered.writes.map(write=>write.progress),[10,75]);assert.equal(ordered.writes[1].revision,1);checks++;
const conflict=harness(()=>{throw Object.assign(Error('Position changed on another device.'),{status:409});});
await conflict.session.flush();await conflict.session.flush();assert.equal(conflict.writes.length,1);
await assert.rejects(()=>conflict.session.saveNow(),/Reload/);checks++;
for(const status of [401,409]) {
  let rejectWrite;
  const pending=harness(()=>new Promise((resolve,reject)=>{rejectWrite=reject;}));
  const automatic=pending.session.flush();await Promise.resolve();await Promise.resolve();
  pending.set({progress:60});const manualSave=pending.session.saveNow();
  const rejected=assert.rejects(manualSave,/Reload/);
  rejectWrite(Object.assign(Error('Save rejected.'),{status}));
  await automatic;await rejected;
  assert.equal(pending.writes.length,1);
  assert.ok(!pending.statuses.includes('Your place is saved.'));checks++;
}
let fail=true;const retry=harness(()=>{if(fail)throw Error('Offline.');});
await retry.session.flush();fail=false;await retry.session.flush();assert.equal(retry.writes.length,2);checks++;
const closing=harness();closing.session.schedule();closing.set({progress:90});await closing.session.close();closing.session.schedule();
assert.equal(closing.timers.size,0);assert.equal(closing.writes.at(-1).progress,90);checks++;
const dom=new JSDOM('<div id="text">'+('abcdefghij'.repeat(10))+'</div>');const win=dom.window,container=win.document.querySelector('#text');
let scroll=120;Object.defineProperty(win,'scrollY',{get:()=>scroll});Object.defineProperty(win,'innerHeight',{value:100});win.scrollTo=(x,y)=>{scroll=y;};
container.getBoundingClientRect=()=>({top:20-scroll,height:200});
win.Range.prototype.getBoundingClientRect=function(){return {top:20+this.startOffset*2-scroll,bottom:20+this.endOffset*2-scroll};};
const anchor=captureAnchor(container);assert.ok(anchor.offset>=48&&anchor.offset<=50);
scroll=0;await restoreAnchor(container,anchor);assert.equal(scroll,120);dom.window.close();checks++;
console.log(`${checks} reading-position/autosave scenarios passed.`);
