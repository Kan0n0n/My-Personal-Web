/** Locate text near the top of the viewport without inserting spans into novels. */
export function captureAnchor(container) {
  const win=container.ownerDocument.defaultView,rect=container.getBoundingClientRect();
  const ratio=Math.min(1,Math.max(0,-rect.top/Math.max(1,rect.height-win.innerHeight)));
  const walker=container.ownerDocument.createTreeWalker(container,4);
  let node,offset=0;
  while((node=walker.nextNode())) {
    if(!node.textContent.trim()){offset+=node.length;continue;}
    const range=container.ownerDocument.createRange();range.selectNodeContents(node);
    const box=range.getBoundingClientRect?.();
    if(box&&box.bottom>=0&&box.top<win.innerHeight) {
      // Find the first visible character so wrapped paragraphs restore accurately.
      let low=0,high=node.length;
      while(low<high){const mid=Math.floor((low+high)/2);range.setStart(node,mid);range.setEnd(node,Math.min(node.length,mid+1));if(range.getBoundingClientRect().bottom<0)low=mid+1;else high=mid;}
      range.setStart(node,low);range.setEnd(node,Math.min(node.length,low+1));
      return {offset:offset+low,y:range.getBoundingClientRect().top/Math.max(1,win.innerHeight),ratio};
    }
    offset+=node.length;
  }
  return {ratio};
}
export async function restoreAnchor(container,anchor={}) {
  const win=container.ownerDocument.defaultView;
  await Promise.all(Array.from(container.querySelectorAll('img'),image=>image.decode?.().catch(()=>{})));
  await container.ownerDocument.fonts?.ready;
  if(!container.isConnected)return;
  if(Number.isInteger(anchor.offset)) {
    const walker=container.ownerDocument.createTreeWalker(container,4);let node,left=anchor.offset;
    while((node=walker.nextNode())) {
      if(left<node.length){const range=container.ownerDocument.createRange();range.setStart(node,left);range.setEnd(node,Math.min(node.length,left+1));const rect=range.getBoundingClientRect?.();if(rect){win.scrollTo(0,win.scrollY+rect.top-(anchor.y||0)*win.innerHeight);return;}break;}
      left-=node.length;
    }
  }
  if(typeof anchor.ratio==='number'){const rect=container.getBoundingClientRect();win.scrollTo(0,win.scrollY+rect.top+Math.max(0,rect.height-win.innerHeight)*anchor.ratio);}
}

/** Serialize saves so pending automatic writes cannot overwrite a manual save. */
export function createReadingSession({capture,revision,write,status,delay=1200,setTimer=setTimeout,clearTimer=clearTimeout}) {
  let timer,queue=Promise.resolve(),generation=0,closed=false,blocked=false,last='';
  function cancel(){clearTimer(timer);timer=undefined;}
  function save(manual=false) {
    cancel();if(closed||blocked){if(manual)return Promise.reject(Error('Reload this book before saving again.'));return Promise.resolve();}
    let snapshot;try{snapshot=capture();}catch(error){if(manual)return Promise.reject(error);return Promise.resolve();}
    if(!snapshot)return Promise.resolve();
    if(manual)generation++;
    const version=generation,signature=JSON.stringify(snapshot);
    queue=queue.catch(()=>{}).then(async()=>{
      if(blocked){if(manual)throw Error('Reload this book before saving again.');return;}
      if(!manual&&version!==generation)return;
      if(signature===last){if(manual)status('Your place is saved.');return;}
      status(manual?'Saving your bookmark…':'Saving reading position…');
      try {await write({...snapshot,...(revision()?{revision:revision()}: {})});last=signature;status(manual?'Your place is saved.':'Reading position saved automatically.');}
      catch(error){if(error.status===409||error.status===401)blocked=true;status('Position not saved. '+error.message);if(manual)throw error;}
    });
    return queue;
  }
  return {
    schedule(){if(closed||blocked)return;cancel();timer=setTimer(()=>save(),delay);},
    saveNow:()=>save(true),flush:()=>save(),
    close(){const result=save();closed=true;cancel();return result;}
  };
}
