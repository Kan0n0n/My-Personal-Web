// Browser/device speech only. No downloaded models, keys, or remote voice fallback.
function textMap(container) {
  const doc=container.ownerDocument,walker=doc.createTreeWalker(container,4),entries=[];
  let node,text='',raw=0,lastBlock;
  while((node=walker.nextNode())) {
    const block=node.parentElement?.closest('p,h1,h2,h3,h4,li,blockquote,pre,[data-pdf-line]');
    if(text&&block!==lastBlock)text+='\n';
    entries.push({node,start:text.length,end:text.length+node.length,raw});
    text+=node.textContent;raw+=node.length;lastBlock=block;
  }
  const toRaw=index=>{const entry=entries.find(entry=>index<entry.end)||entries.at(-1);return entry?entry.raw+Math.max(0,Math.min(entry.node.length,index-entry.start)):0;};
  const toText=offset=>{const entry=entries.find(entry=>offset<entry.raw+entry.node.length)||entries.at(-1);return entry?entry.start+Math.max(0,Math.min(entry.node.length,offset-entry.raw)):0;};
  function range(start,end) {
    const first=entries.find(entry=>start<entry.end),last=entries.findLast(entry=>entry.start<end);
    if(!first||!last)return null;
    const result=doc.createRange();result.setStart(first.node,Math.max(0,start-first.start));result.setEnd(last.node,Math.min(last.node.length,Math.max(0,end-last.start)));return result;
  }
  return {text,toRaw,toText,range};
}

export function createSpeechReader({root,container,kind='epub',preferences={},getOffset=()=>0,nextPage=async()=>false,onPosition=()=>{},flush=()=>{},onPreferences=()=>{},isCurrent=()=>true}) {
  const doc=root.ownerDocument,win=doc.defaultView,synth=win.speechSynthesis;
  const $=selector=>root.querySelector(selector);
  const play=$('#speech-play'),pause=$('#speech-pause'),stopButton=$('#speech-stop'),voiceSelect=$('#speech-voice'),rate=$('#speech-rate'),follow=$('#speech-follow'),status=$('#speech-status'),overlay=$('#speech-highlight-layer');
  let voices=[],epoch=0,mode='idle',destroyed=false,cursor=null,map,segments=[],part=0,highlightRange,wordMode=false,preferred=preferences.voiceURI||'';
  rate.value=String(preferences.rate||1);if(!rate.value)rate.value='1';follow.checked=preferences.follow!==false;
  const available=()=>!destroyed&&isCurrent();
  function sayStatus(message){if(available())status.textContent=message;}
  function clearHighlight(){win.CSS?.highlights?.delete('novel-spoken');overlay.replaceChildren();highlightRange=null;}
  function paint() {
    overlay.replaceChildren();
    if(!highlightRange)return;
    if(win.CSS?.highlights&&win.Highlight){win.CSS.highlights.set('novel-spoken',new win.Highlight(highlightRange));return;}
    for(const rect of Array.from(highlightRange.getClientRects?.()||[]).slice(0,80)) {
      if(!rect.width||!rect.height)continue;
      const box=doc.createElement('span');box.className='speech-highlight-box';
      Object.assign(box.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});overlay.append(box);
    }
  }
  function highlight(start,end) {
    highlightRange=map.range(start,end);paint();
    const rect=highlightRange?.getBoundingClientRect?.();
    if(follow.checked&&rect&&(rect.top<win.innerHeight*0.15||rect.bottom>win.innerHeight*0.8))win.scrollTo({top:win.scrollY+rect.top-win.innerHeight*0.3,behavior:'auto'});
  }
  function controls(){play.disabled=!available()||!synth||!win.SpeechSynthesisUtterance||!voices.length||mode==='speaking'||(kind==='pdf'&&!container.textContent.trim());pause.disabled=mode!=='speaking'&&mode!=='paused';pause.textContent=mode==='paused'?'Resume':'Pause';stopButton.disabled=mode==='idle';}
  function loadVoices() {
    const selected=voiceSelect.value||preferred;
    voices=(synth?.getVoices()||[]).filter(voice=>voice.localService===true).sort((a,b)=>Number(b.default)-Number(a.default)||a.name.localeCompare(b.name));
    voiceSelect.replaceChildren(...voices.map(voice=>{const option=doc.createElement('option');option.value=voice.voiceURI;option.textContent=`${voice.name} (${voice.lang}) · device`;return option;}));
    voiceSelect.value=voices.some(voice=>voice.voiceURI===selected)?selected:voices[0]?.voiceURI||'';
    controls();
    if(!synth||!win.SpeechSynthesisUtterance)sayStatus('Read-aloud is unavailable in this browser.');
    else if(!voices.length)sayStatus('No installed local voices are available. Enable an operating-system speech voice, then reopen the reader.');
    else if(kind==='pdf'&&!container.textContent.trim())sayStatus('This PDF page has no selectable text. Scanned pages need OCR and cannot be read aloud here.');
    else if(mode==='idle')sayStatus('Ready. Uses device voices only. Select a sentence or press Read aloud from your visible position.');
  }
  function preferencesNow(){return {voiceURI:voiceSelect.value||preferred,rate:Number(rate.value)||1,follow:follow.checked};}
  function savePosition(){try{const result=flush();result?.catch?.(()=>{});}catch{/* Autosave status reports persistence failures. */}}
  function stop(message='Read-aloud stopped.',save=true) {
    if(save&&mode!=='idle')savePosition();
    epoch++;synth?.cancel();mode='idle';cursor=null;clearHighlight();controls();sayStatus(message);
  }
  function selectedOffset() {
    const selection=win.getSelection?.();
    if(selection?.rangeCount&&!selection.isCollapsed) {
      const range=selection.getRangeAt(0);
      if(container.contains(range.startContainer)&&container.contains(range.endContainer)){const before=doc.createRange();before.selectNodeContents(container);before.setEnd(range.startContainer,range.startOffset);return before.toString().length;}
    }
    return getOffset()||0;
  }
  function rebuild(offset) {
    map=textMap(container);wordMode=false;
    segments=Array.from(new Intl.Segmenter(undefined,{granularity:'sentence'}).segment(map.text)).filter(segment=>segment.segment.trim()).flatMap(segment=>{
      const chunks=[];let start=segment.index,remaining=segment.segment;
      while(remaining.length){let length=Math.min(400,remaining.length);if(length<remaining.length){const space=remaining.lastIndexOf(' ',length);if(space>100)length=space+1;else {const next=remaining.indexOf(' ',length);length=next>=0?next+1:remaining.length;}}chunks.push({start,end:start+length,sentenceStart:segment.index,sentenceEnd:segment.index+segment.segment.length});start+=length;remaining=remaining.slice(length);}
      return chunks;
    });
    const target=map.toText(offset);part=segments.findIndex(segment=>segment.end>target);if(part<0)part=segments.length;
  }
  async function speakNext(run) {
    if(run!==epoch||!available()||mode!=='speaking')return;
    if(part>=segments.length) {
      savePosition();
      if(!await nextPage()){if(run===epoch)stop('Finished this book.',false);return;}
      if(run!==epoch||!available())return;
      rebuild(0);cursor=0;
      if(!segments.length&&kind==='pdf'){stop('This PDF page has no selectable text. Read-aloud stopped.',false);return;}
      return speakNext(run);
    }
    const segment=segments[part],utterance=new win.SpeechSynthesisUtterance(map.text.slice(segment.start,segment.end));
    const voice=voices.find(voice=>voice.voiceURI===voiceSelect.value);
    if(!voice){stop('The selected device voice is no longer available.');return;}
    utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=Number(rate.value)||1;
    cursor=map.toRaw(segment.start);highlight(segment.sentenceStart,segment.sentenceEnd);onPosition();
    sayStatus(wordMode?'Reading · word highlighting.':'Reading · sentence highlighting (word following when supported by this voice).');
    utterance.onboundary=event=>{
      if(run!==epoch||!available()||mode!=='speaking'||event.name!=='word'||!Number.isFinite(event.charIndex)||event.charIndex<0||event.charIndex>=utterance.text.length)return;
      const start=segment.start+event.charIndex;
      const word=Array.from(new Intl.Segmenter(voice.lang||undefined,{granularity:'word'}).segment(map.text.slice(start,segment.end)))[0];
      const length=event.charLength>0?event.charLength:word?.segment.length||1;
      cursor=map.toRaw(start);highlight(start,Math.min(segment.end,start+length));
      if(!wordMode){wordMode=true;sayStatus('Reading · word highlighting.');}onPosition();
    };
    utterance.onend=()=>{if(run!==epoch||!available()||mode!=='speaking')return;cursor=map.toRaw(segment.end);part++;speakNext(run).catch(error=>{if(run===epoch)stop('Read-aloud stopped. '+error.message);});};
    utterance.onerror=event=>{if(run===epoch&&available())stop('Voice could not finish reading ('+(event.error||'speech error')+'). Try another device voice.');};
    try{synth.speak(utterance);}catch(error){stop('Could not start the device voice. '+error.message);}
  }
  async function start(offset) {
    if(!available()||!synth||!win.SpeechSynthesisUtterance||!voices.length)return;
    epoch++;synth.cancel();mode='speaking';rebuild(offset??selectedOffset());controls();
    if(kind==='pdf'&&!segments.length){stop('This PDF page has no selectable text.',false);return;}
    try{await speakNext(epoch);}catch(error){if(available())stop('Read-aloud stopped. '+error.message);}
  }
  play.onclick=()=>start();
  pause.onclick=()=>{
    if(mode==='paused'){start(cursor??selectedOffset());return;}
    if(mode!=='speaking')return;
    epoch++;synth.cancel();mode='paused';controls();savePosition();sayStatus('Paused. Resume restarts the current sentence.');
  };
  stopButton.onclick=()=>stop();
  function changed(){preferred=voiceSelect.value;const wasActive=mode==='speaking',offset=cursor;onPreferences(preferencesNow());if(wasActive)start(offset||0);}
  voiceSelect.onchange=changed;rate.onchange=changed;follow.onchange=()=>onPreferences(preferencesNow());
  const beforePage=event=>{if(event.detail?.source!=='tts')stop('Page changed. Press Read aloud to continue.');};
  const afterPage=()=>loadVoices();
  const onHide=()=>stop('Read-aloud stopped.');
  root.addEventListener('reader-before-page-change',beforePage);root.addEventListener('reader-page-change',afterPage);
  win.addEventListener('pagehide',onHide);win.addEventListener('scroll',paint,{passive:true});win.addEventListener('resize',paint);
  synth?.addEventListener?.('voiceschanged',loadVoices);loadVoices();
  return {
    preferences:preferencesNow,
    anchor:()=>cursor!==null&&mode!=='idle'?{offset:Math.min(cursor,Math.max(0,container.textContent.length-1)),y:0.3}:null,
    stop,
    destroy(){if(destroyed)return;stop('',false);destroyed=true;synth?.removeEventListener?.('voiceschanged',loadVoices);root.removeEventListener('reader-before-page-change',beforePage);root.removeEventListener('reader-page-change',afterPage);win.removeEventListener('pagehide',onHide);win.removeEventListener('scroll',paint);win.removeEventListener('resize',paint);}
  };
}
