import {unzipSync, strFromU8} from 'fflate';
import DOMPurify from 'dompurify';

const $=(selector,root)=>root.querySelector(selector);
function xml(bytes,label) {
  if (!bytes) throw Error(`The EPUB is missing ${label}.`);
  let source=strFromU8(bytes);
  if (/<!ENTITY|<!DOCTYPE[^>]*\[/i.test(source)) throw Error('EPUB documents with custom entities are unsupported.');
  // EPUB 2 NCX files commonly declare an external DTD. Never load it.
  source=source.replace(/<!DOCTYPE[^>]*>/gi,'');
  const doc=new DOMParser().parseFromString(source,'application/xml');
  if (doc.querySelector('parsererror')) throw Error(`The EPUB has invalid ${label}.`);
  return doc;
}
function archivePath(base,relative) {
  try {
    const url=new URL(relative,'https://epub.invalid/'+base);
    if (url.origin!=='https://epub.invalid') return null;
    return decodeURIComponent(url.pathname.slice(1));
  } catch { return null; }
}
const cleanLabel=text=>(text||'').replace(/\s+/g,' ').trim().slice(0,300);
function tableOfContents(files,packagePath,pkg,items) {
  const labels=[];
  const seen=new Set();
  function add(base,href,label) {
    if (!href||!cleanLabel(label)) return;
    try {
      const file=archivePath(base,href);
      const hash=new URL(href,'https://epub.invalid/'+base).hash.slice(1);
      const anchor=decodeURIComponent(hash);
      const key=file+'#'+anchor;
      if (file&&files[file]&&!seen.has(key)) {labels.push({file,anchor,label:cleanLabel(label)});seen.add(key);}
    } catch { /* Ignore a malformed TOC link; spine reading is still available. */ }
  }
  const navigation=Array.from(items.values()).find(item=>(item.getAttribute('properties')||'').split(/\s+/).includes('nav'));
  if (navigation) {
    try {
      const file=archivePath(packagePath,navigation.getAttribute('href'));
      const doc=xml(files[file],'navigation document');
      const nav=Array.from(doc.getElementsByTagNameNS('*','nav')).find(node=>(node.getAttributeNS('http://www.idpf.org/2007/ops','type')||node.getAttribute('epub:type')||'').split(/\s+/).includes('toc')||node.getAttribute('role')==='doc-toc');
      for (const link of Array.from(nav?.getElementsByTagNameNS('*','a')||[])) add(file,link.getAttribute('href'),link.textContent);
    } catch { /* Older NCX navigation or chapter headings can supply labels. */ }
  }
  const spine=pkg.getElementsByTagNameNS('*','spine')[0];
  const ncx=labels.length?null:items.get(spine?.getAttribute('toc'))||Array.from(items.values()).find(item=>item.getAttribute('media-type')==='application/x-dtbncx+xml');
  if (ncx) {
    try {
      const file=archivePath(packagePath,ncx.getAttribute('href'));
      const doc=xml(files[file],'NCX navigation');
      for (const point of Array.from(doc.getElementsByTagNameNS('*','navPoint'))) {
        // Read direct children so nested points retain their own titles.
        const label=Array.from(point.children).find(node=>node.localName==='navLabel');
        const content=Array.from(point.children).find(node=>node.localName==='content');
        add(file,content?.getAttribute('src'),label?.textContent);
      }
    } catch { /* Missing/broken NCX must not prevent opening a readable EPUB. */ }
  }
  return labels;
}
function unpack(bytes) {
  let total=0,count=0;
  const files=unzipSync(bytes,{filter:file=>{
    if (++count>5000||(total+=file.originalSize)>100*1024*1024) throw Error('EPUB contents exceed the 100 MiB / 5,000 file limit.');
    return true;
  }});
  if (files['META-INF/encryption.xml']) throw Error('Encrypted / DRM-protected EPUBs cannot be opened here.');
  if (!files.mimetype||strFromU8(files.mimetype).trim()!=='application/epub+zip') throw Error('Not a valid EPUB file.');
  const container=xml(files['META-INF/container.xml'],'container.xml');
  const packagePath=container.getElementsByTagNameNS('*','rootfile')[0]?.getAttribute('full-path');
  if (!packagePath) throw Error('The EPUB has no package document.');
  const pkg=xml(files[packagePath],'package document');
  const items=new Map(Array.from(pkg.getElementsByTagNameNS('*','item'),item=>[item.getAttribute('id'),item]));
  const toc=tableOfContents(files,packagePath,pkg,items);
  const chapters=Array.from(pkg.getElementsByTagNameNS('*','itemref')).filter(item=>item.getAttribute('linear')!=='no').map((item,index)=>{
    const manifest=items.get(item.getAttribute('idref'));
    const file=manifest&&archivePath(packagePath,manifest.getAttribute('href'));
    if (!file||!files[file]||!['application/xhtml+xml','text/html'].includes(manifest.getAttribute('media-type'))) throw Error('The EPUB has an unsupported or missing chapter.');
    return {file};
  });
  if (!chapters.length) throw Error('This EPUB has no readable chapters.');
  return {files,chapters,toc,pkg,items,packagePath};
}
function chapterFragment(files,file) {
  // Only archive-local raster images can become resources. EPUB scripts, links,
  // CSS, forms, SVG, and remote resources never enter the live document.
  DOMPurify.addHook('uponSanitizeAttribute',(node,data)=>{
    if (data.attrName!=='src') return;
    const local=archivePath(file,data.attrValue);
    const image=local&&files[local];
    const ext=local?.split('.').pop().toLowerCase();
    const mime={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp'}[ext];
    if (node.nodeName!=='IMG'||!image||!mime||image.length>8*1024*1024) { data.keepAttr=false; return; }
    let binary='';
    for (let i=0;i<image.length;i+=8192) binary+=String.fromCharCode(...image.subarray(i,i+8192));
    data.attrValue=`data:${mime};base64,${btoa(binary)}`;
  });
  try {
    return DOMPurify.sanitize(strFromU8(files[file]),{
      RETURN_DOM_FRAGMENT:true,
      ALLOWED_TAGS:['h1','h2','h3','h4','h5','h6','p','div','span','a','br','hr','em','strong','b','i','u','s','sub','sup','blockquote','pre','code','ul','ol','li','dl','dt','dd','table','thead','tbody','tr','th','td','img','figure','figcaption','ruby','rt','rp'],
      ALLOWED_ATTR:['id','name','src','alt','title','colspan','rowspan','lang','dir'],
      SANITIZE_NAMED_PROPS:true,
      ALLOW_DATA_ATTR:false,ALLOW_ARIA_ATTR:false
    });
  } finally { DOMPurify.removeHook('uponSanitizeAttribute'); }
}

// Fixed content pages keep numbering stable across font and screen changes.
// Aim for 1,800 characters, keeping each sentence intact even across inline tags.
// A sentence longer than the target gets a larger page; illustrations stand alone.
function paginateEPUB(archive,fallbackTitle) {
  const pages=[];
  let label=archive.toc[0]?.label||fallbackTitle;
  archive.chapters.forEach(({file},spine)=>{
    const fragment=chapterFragment(archive.files,file);
    const entries=archive.toc.filter(entry=>entry.file===file);
    const rootTitle=entries.find(entry=>!entry.anchor);
    if (rootTitle) label=rootTitle.label;
    const anchors=new Map(entries.filter(entry=>entry.anchor).map(entry=>['user-content-'+entry.anchor,entry.label]));
    const pieces=[];
    const collect=node=>{
      if(node.nodeType===3) pieces.push(node.textContent);
      else if(node.nodeType===1&&node.tagName==='IMG') {if(node.hasAttribute('src'))pieces.push('\uFFFC');}
      else for(const child of node.childNodes)collect(child);
    };
    collect(fragment);
    const sentences=Array.from(new Intl.Segmenter(undefined,{granularity:'sentence'}).segment(pieces.join('')),part=>({start:part.index,end:part.index+part.segment.length}));
    let sentenceIndex=0;
    let page,clones,used=0,offset=0;
    const fresh=()=>{page={fragment:document.createDocumentFragment(),label,spine,start:offset,end:offset};clones=new Map([[fragment,page.fragment]]);used=0;};
    const finish=()=>{if(page.fragment.textContent.trim()||page.fragment.querySelector('img')){page.end=offset;pages.push(page);}fresh();};
    const parentFor=node=>{
      if (clones.has(node)) return clones.get(node);
      const clone=node.cloneNode(false);parentFor(node.parentNode).append(clone);clones.set(node,clone);return clone;
    };
    fresh();
    const visit=node=>{
      if (node.nodeType===1) {
        const title=anchors.get(node.getAttribute('id'))||anchors.get(node.getAttribute('name'));
        if (title&&title!==label) {finish();label=title;page.label=label;}
        if (node.tagName==='IMG') {
          if (!node.hasAttribute('src')) return;
          finish();parentFor(node.parentNode).append(node.cloneNode(true));offset++;finish();return;
        }
        if (['BR','HR'].includes(node.tagName)) {parentFor(node.parentNode).append(node.cloneNode(false));return;}
        for (const child of node.childNodes) visit(child);
      } else if (node.nodeType===3) {
        let text=node.textContent;
        while(text.length) {
          while(sentenceIndex<sentences.length-1&&offset>=sentences[sentenceIndex].end)sentenceIndex++;
          const sentence=sentences[sentenceIndex];
          if (used&&offset===sentence.start&&used+sentence.end-offset>1800) finish();
          const take=Math.min(text.length,sentence.end-offset);
          parentFor(node.parentNode).append(document.createTextNode(text.slice(0,take)));
          used+=take;offset+=take;text=text.slice(take);
        }
      }
    };
    for(const node of fragment.childNodes) visit(node);
    finish();
  });
  if (!pages.length) throw Error('This EPUB has no readable content.');
  return pages;
}

export async function loadBookCover(book) {
  const response=await fetch(`/api/me/books/${book.id}/file`,{credentials:'same-origin'});
  if(!response.ok) throw Error('Cover unavailable.');
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(book.format==='epub') {
    const archive=unpack(bytes);
    const {files,items,pkg,packagePath}=archive;
    const meta=Array.from(pkg.getElementsByTagNameNS('*','meta')).find(node=>node.getAttribute('name')==='cover');
    const cover=Array.from(items.values()).find(item=>(item.getAttribute('properties')||'').split(/\s+/).includes('cover-image'))||items.get(meta?.getAttribute('content'));
    let file=cover&&archivePath(packagePath,cover.getAttribute('href'));
    if(!file) {
      const guide=Array.from(pkg.getElementsByTagNameNS('*','reference')).find(node=>node.getAttribute('type')==='cover');
      const page=guide?archivePath(packagePath,guide.getAttribute('href')):archive.chapters[0].file;
      try {
        const image=chapterFragment(files,page).querySelector('img[src]');
        const data=image?.getAttribute('src').match(/^data:(image\/[a-z]+);base64,(.+)$/);
        if(data)return new Blob([Uint8Array.from(atob(data[2]),char=>char.charCodeAt(0))],{type:data[1]});
      } catch { /* A missing cover does not prevent reading the book. */ }
    }
    const mime={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif'}[file?.split('.').pop().toLowerCase()];
    if(!mime||!files[file]||files[file].length>8*1024*1024)return null;
    return new Blob([files[file]],{type:mime});
  }
  if(book.format==='pdf') {
    const lib=await import('pdfjs-dist/build/pdf.mjs');
    lib.GlobalWorkerOptions.workerSrc='/assets/vendor/pdf.worker.mjs';
    const task=lib.getDocument({data:bytes,isEvalSupported:false,enableXfa:false,cMapUrl:'/assets/vendor/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/assets/vendor/pdfjs/standard_fonts/',wasmUrl:'/assets/vendor/pdfjs/wasm/'});
    try {
      const pdf=await task.promise,page=await pdf.getPage(1),base=page.getViewport({scale:1});
      const viewport=page.getViewport({scale:Math.min(240/base.width,340/base.height)});
      const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
      return await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    } finally {await task.destroy();}
  }
  return null;
}

export async function openFormatReader({book,container,root,saved,isCurrent}) {
  const response=await fetch(`/api/me/books/${book.id}/file`,{credentials:'same-origin'});
  if (!response.ok) { const error=await response.json().catch(()=>({})); throw Error(error.error||'File unavailable. Sign in again if your session expired.'); }
  const bytes=new Uint8Array(await response.arrayBuffer());
  if (!isCurrent()) return;
  const nav=$('#format-navigation',root), select=$('#reader-section',root),prev=$('#reader-prev',root),next=$('#reader-next',root),status=$('#bookmark-status',root);
  const bottomNav=$('#format-navigation-bottom',root),bottomPrev=$('#reader-prev-bottom',root),bottomNext=$('#reader-next-bottom',root),bottomLabel=$('#reader-section-bottom',root);
  const nextTitle=$('#reader-next-title',root);
  let pdf,pdfLib,task,renderTask,archive,chapters,count,index=0,destroyed=false,rendering=false;
  const alive=()=>!destroyed&&isCurrent();
  const destroy=()=>{destroyed=true;renderTask?.cancel();task?.destroy()?.catch(()=>{});};
  try {
    if (book.format==='pdf') {
      const lib=await import('pdfjs-dist/build/pdf.mjs');
      pdfLib=lib;
      if (!alive()) return {destroy};
      lib.GlobalWorkerOptions.workerSrc='/assets/vendor/pdf.worker.mjs';
      task=lib.getDocument({data:bytes,isEvalSupported:false,enableXfa:false,cMapUrl:'/assets/vendor/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/assets/vendor/pdfjs/standard_fonts/',wasmUrl:'/assets/vendor/pdfjs/wasm/'});
      pdf=await task.promise;
      count=pdf.numPages;
      container.classList.add('pdf-reader');
      $('[data-action="font-down"]',root).textContent='Zoom −';
      $('[data-action="font-up"]',root).textContent='Zoom +';
    } else {
      archive=unpack(bytes); chapters=paginateEPUB(archive,book.title); count=chapters.length;
      container.classList.add('epub-reader');
    }
    if (!alive()) { destroy(); return {destroy}; }
    const pageLocator=String(saved.locator||'').match(/^epubpage:(\d+):(\d+)$/);
    const locator=String(saved.locator||'').match(/^(pdf|epub):(\d+)(?::([\d.]+))?$/);
    index=locator&&locator[1]===book.format?Number(locator[2])-1:Math.round((Number(saved.progress)||0)/100*Math.max(0,count-1));
    if (!pdf&&(pageLocator||locator?.[1]==='epub')) {
      const spine=Number(pageLocator?pageLocator[1]:locator[2])-1;
      const candidates=chapters.map((page,i)=>({...page,index:i})).filter(page=>page.spine===spine);
      const offset=pageLocator?Number(pageLocator[2]):Number(locator[3]||0)/100*(candidates.at(-1)?.end||0);
      const match=candidates.find(page=>offset<page.end)||candidates.at(-1);
      if (match) index=match.index;
    }
    index=Math.min(count-1,Math.max(0,index));
    select.replaceChildren(...Array.from({length:count},(_,i)=>{
      const option=document.createElement('option');option.value=String(i);option.textContent=pdf?`Page ${i+1} of ${count}`:`${chapters[i].label} - Page ${i+1}`;return option;
    }));
    nav.hidden=false;
    bottomNav.hidden=false;
    bottomPrev.textContent='← Previous page';
    bottomNext.textContent='Next page →';
    nextTitle.hidden=!!pdf;
    const followingTitle=()=>pdf?-1:chapters.findIndex((page,i)=>i>index&&page.label!==chapters[index].label);
    async function render(target,restore=false) {
      if (rendering||!alive()) return;
      rendering=true; index=Math.min(count-1,Math.max(0,target));
      prev.disabled=true;next.disabled=true;bottomPrev.disabled=true;bottomNext.disabled=true;nextTitle.disabled=true;select.disabled=true;
      container.setAttribute('aria-busy','true');
      try {
        if (pdf) {
          const page=await pdf.getPage(index+1);
          if (!alive()) return;
          const base=page.getViewport({scale:1});
          const width=Math.min(2000,(container.clientWidth||700)*(parseInt(container.style.fontSize)||18)/18);
          const viewport=page.getViewport({scale:width/base.width});
          const scale=Math.min(window.devicePixelRatio||1,2);
          const canvas=document.createElement('canvas');
          canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Page ${index+1} of ${book.title}. Selectable text is available when the original PDF contains text.`);
          canvas.width=Math.ceil(viewport.width*scale);canvas.height=Math.ceil(viewport.height*scale);
          canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
          const pageView=document.createElement('div');pageView.className='pdf-page-view';pageView.style.width=viewport.width+'px';pageView.style.height=viewport.height+'px';pageView.append(canvas);
          container.replaceChildren(pageView);
          renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport,transform:scale===1?null:[scale,0,0,scale,0,0]});
          await renderTask.promise;
          const content=await page.getTextContent().catch(()=>({items:[],styles:{}}));
          if(!alive())return;
          const layer=document.createElement('div');layer.className='pdf-reader-text-layer';layer.setAttribute('aria-label','Selectable PDF text');
          const measure=document.createElement('canvas').getContext('2d');
          for(const item of content.items) {
            if(typeof item.str!=='string'||!item.str)continue;
            const matrix=pdfLib.Util.transform(viewport.transform,item.transform),style=content.styles[item.fontName]||{};
            const height=Math.hypot(matrix[2],matrix[3]),angle=Math.atan2(matrix[1],matrix[0]);
            const ascent=height*(style.ascent??(style.descent!==undefined?1+style.descent:0.8));
            const span=document.createElement('span');span.setAttribute('data-pdf-line','');span.textContent=item.str+(item.hasEOL?'\n':' ');
            const family=style.fontFamily||'sans-serif';measure.font=`${height}px ${family}`;
            const width=measure.measureText(item.str).width;
            Object.assign(span.style,{left:(matrix[4]+ascent*Math.sin(angle))+'px',top:(matrix[5]-ascent*Math.cos(angle))+'px',fontSize:height+'px',fontFamily:family,transform:`rotate(${angle}rad) scaleX(${width?item.width*viewport.scale/width:1})`});
            layer.append(span);
          }
          pageView.append(layer);page.cleanup();
        } else container.replaceChildren(chapters[index].fragment.cloneNode(true));
        if (!alive()) return;
        select.value=String(index);
        status.textContent=pdf?`Page ${index+1} of ${count}. Keep my place saves this page.`:`${chapters[index].label} - Page ${index+1} of ${count}. Keep my place saves this page.`;
        bottomLabel.textContent=pdf?`Page ${index+1} of ${count}`:`${chapters[index].label} - Page ${index+1}`;
        if (!restore) container.scrollIntoView({block:'start'});
      } finally {
        rendering=false;
        if (alive()) {container.setAttribute('aria-busy','false');prev.disabled=bottomPrev.disabled=index===0;next.disabled=bottomNext.disabled=index===count-1;nextTitle.disabled=followingTitle()<0;select.disabled=false;}
      }
    }
    const turn=async(target,source='manual')=>{
      if(rendering||!alive())return false;
      const Event=root.ownerDocument.defaultView.CustomEvent;
      root.dispatchEvent(new Event('reader-before-page-change',{detail:{source}}));
      try {await render(target);if(alive())root.dispatchEvent(new Event('reader-page-change',{detail:{source}}));return alive();}
      catch(error){if(alive())status.textContent='Could not render this section. '+error.message;return false;}
    };
    prev.onclick=()=>turn(index-1);next.onclick=()=>turn(index+1);select.onchange=()=>turn(Number(select.value));
    bottomPrev.onclick=()=>turn(index-1);bottomNext.onclick=()=>turn(index+1);
    nextTitle.onclick=()=>{const target=followingTitle();if(target>=0)return turn(target);};
    await render(index,true);
    return {destroy,advance:()=>index<count-1?turn(index+1,'tts'):Promise.resolve(false),resize:()=>pdf?render(index,true):Promise.resolve(),position(){
      if (rendering) throw Error('Wait for this page to finish opening before saving your place.');
      if (pdf) return {progress:count===1?100:index/(count-1)*100,locator:`pdf:${index+1}`};
      return {progress:(index+1)/count*100,locator:`epubpage:${chapters[index].spine+1}:${chapters[index].start}`};
    }};
  } catch (error) {
    destroy();
    if (error.name==='PasswordException') throw Error('This PDF is password-protected. Import an unlocked copy.');
    throw error;
  }
}
