/* Behaviour only. Edit page layouts in pages/*.html and reusable markup in
   templates/components.html. See docs/EDITING-GUIDE.md for the HTML hooks. */
'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dateLabel = date => new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'});

const defaults = {
  version: 1,
  profile: {
    name: 'Philine',
    bio: 'A collector of stories, little moments, and things worth keeping.',
    status: 'Putting my little world back together',
    intro: 'Welcome to my little corner of the internet. A home for ordinary days, unfinished ideas, and all the stories I want to keep close.\n\nThis picture book is slowly finding its pages again. Make yourself comfortable, have a look around, and stay a little while. ♡',
    watching: 'Something for a quiet evening',
    playing: 'Taking a little break',
    doing: 'Rebuilding this picture book',
    song: 'Your music of the day',
    artist: 'Choose a track from your collection',
    musicCover: '',
    musicUrl: ''
  },
  posts: [], blogs: [], tasks: [], anime: [], documents: [], events: [], reading: {}
};

// For a fresh notebook, visible HTML is the source of profile defaults.
$$('[data-profile]').forEach(element => {
  const key = element.dataset.profile;
  if (Object.hasOwn(defaults.profile, key)) defaults.profile[key] = element.textContent;
});

let state = structuredClone(defaults);
let profileOverrides = false;
let authenticated = false;

/** Empty optional profile copy uses the page defaults, including new accounts. */
function profileWithDefaults(profile = {}) {
  const result = {...defaults.profile, ...profile};
  for (const key of Object.keys(defaults.profile)) {
    if (typeof result[key] === 'string' && !result[key].trim()) result[key] = defaults.profile[key];
  }
  return result;
}

/** Server data is authoritative. Browser stores are read only for legacy export. */
async function apiRequest(path, method = 'GET', body, options = {}) {
  const response = await fetch(path, {
    ...options, method, credentials: 'same-origin', headers: body === undefined ? {} : {'Content-Type': 'application/json'},
    ...(body === undefined ? {} : {body: JSON.stringify(body)})
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) { authenticated = false; applyAuthorization(); }
    const error=Error(data.error || 'The server could not complete this request.');error.status=response.status;throw error;
  }
  return data;
}
function requireOwner() {
  if (!authenticated) throw Error('Sign in to use your private notebook.');
}
async function loadNotebook() {
  const session = await apiRequest('/api/auth/session');
  authenticated = session.authenticated;
  const data = await apiRequest(authenticated ? '/api/me/notebook' : '/api/public/notebook');
  state = validate({...defaults, ...data, profile: {...defaults.profile, ...data.profile}});
  profileOverrides = true;
}
async function saveProfile(data) {
  requireOwner();
  state.profile = profileWithDefaults(await apiRequest('/api/me/profile', 'PUT', data));
  profileOverrides = true;
  return true;
}
async function saveRecord(key, data, old) {
  requireOwner();
  const result = await apiRequest(`/api/me/records/${key}${old ? '/' + old.id : ''}`, old ? 'PUT' : 'POST', {...data, ...(old ? {revision: old.revision} : {})});
  const index = state[key].findIndex(record => record.id === result.id);
  if (index < 0) state[key].unshift(result); else state[key][index] = result;
  return result;
}
async function trashRecord(key, id) {
  requireOwner();
  const old = state[key].find(record => record.id === id);
  if (!old) throw Error('Reload this page before trying again.');
  await apiRequest(`/api/me/records/${key}/${id}/trash`, 'POST', {revision: old.revision});
  state[key] = state[key].filter(record => record.id !== id);
  return true;
}

const page = document.body.dataset.page;
const calendarDate = new Date();
calendarDate.setDate(1);
const originalMusicCover = $('#music-cover')?.getAttribute('src') || '../assets/images/Philine-P5V6.webp';
const initialMusicCover = safeURL(originalMusicCover) === '#' ? '../assets/images/Philine-P5V6.webp' : originalMusicCover;
let toastTimer;
let books = [];
let activeBook;
let libraryFolders = [];
let selectedFolder = '';
let formatReader;
let bookOpenToken = 0;
let uploadingBooks = false;
let readingSession;
let readingTools;
let readingCleanup;
let speechTools;
let speechReader;
const novelFonts={georgia:'Georgia, serif',overlock:'Overlock, sans-serif',palatino:'Palatino Linotype, Book Antiqua, serif',arial:'Arial, sans-serif',verdana:'Verdana, sans-serif',monospace:'Consolas, monospace'};
const bookCoverCache = new Map();
let bookPreviewTimer;
let bookPreviewToken = 0;

function hideBookPreview() {
  clearTimeout(bookPreviewTimer);bookPreviewToken++;
  const preview=$('#book-cover-preview');if(preview)preview.hidden=true;
}
function previewBookCover(book,button) {
  hideBookPreview();
  if(!['pdf','epub'].includes(book.format))return;
  const token=bookPreviewToken;
  bookPreviewTimer=setTimeout(async()=>{
    const preview=$('#book-cover-preview'),image=$('#book-cover-image'),status=$('#book-cover-status');
    if(token!==bookPreviewToken||!authenticated)return;
    $('#book-cover-title').textContent=book.title;image.hidden=true;status.textContent='Loading cover…';preview.hidden=false;
    image.onerror=()=>{if(token===bookPreviewToken){image.hidden=true;status.textContent='Cover image could not be displayed.';}};
    const rect=button.getBoundingClientRect();
    preview.style.left=Math.max(8,Math.min(window.innerWidth-238,rect.right+12))+'px';
    preview.style.top=Math.max(8,Math.min(window.innerHeight-390,rect.top))+'px';
    try {
      let cached=bookCoverCache.get(book.id);
      if(!cached) {
        cached={};bookCoverCache.set(book.id,cached);
        cached.promise=import('./novel-formats.mjs').then(module=>module.loadBookCover(book)).then(blob=>{
          if(!blob)return null;
          const url=URL.createObjectURL(blob);
          if(bookCoverCache.get(book.id)!==cached){URL.revokeObjectURL(url);return null;}
          cached.url=url;return url;
        });
        while(bookCoverCache.size>20){const [id,old]=bookCoverCache.entries().next().value;if(old.url)URL.revokeObjectURL(old.url);bookCoverCache.delete(id);}
      }
      const url=await cached.promise;
      if(token!==bookPreviewToken||!authenticated)return;
      image.hidden=!url;if(url){image.src=url;image.alt='Cover of '+book.title;}
      status.textContent=url?'':'No embedded cover available.';
    } catch {if(token===bookPreviewToken)status.textContent='Cover preview unavailable.';bookCoverCache.delete(book.id);}
  },200);
}

function closeBookReader() {
  const pending=readingSession?.close();readingSession=undefined;readingCleanup?.();readingCleanup=undefined;
  speechReader?.destroy();speechReader=undefined;
  bookOpenToken++;
  formatReader?.destroy();
  formatReader = undefined;
  return pending;
}

function startReadingSession(id,root,text,token) {
  const current=()=>token===bookOpenToken&&activeBook===id&&authenticated;
  readingSession=readingTools.createReadingSession({
    capture:()=>{
      if(!current())return null;
      const top=window.scrollY+text.getBoundingClientRect().top;
      const position=formatReader?formatReader.position():{progress:Math.min(100,Math.max(0,(window.scrollY-top)/Math.max(1,text.offsetHeight-window.innerHeight)*100))};
      return {...position,font:parseInt(text.style.fontSize),theme:root.classList.contains('dark')?'dark':'light',fontFamily:$('#reader-font',root).value,alignment:$('#reader-alignment',root).value,speech:speechReader?.preferences()||state.reading[id]?.speech||{},anchor:speechReader?.anchor()||readingTools.captureAnchor(text)};
    },
    revision:()=>state.reading[id]?.revision,
    write:async data=>{state.reading[id]=await apiRequest(`/api/me/books/${id}/progress`,'PUT',data,{keepalive:true});},
    status:message=>{if(current())$('#autosave-status',root).textContent=message;}
  });
  const session=readingSession;
  const heartbeat=window.setInterval(()=>session.flush(),15000);
  const schedule=()=>session.schedule(),flush=()=>{session.flush();};
  const hidden=()=>{if(document.visibilityState==='hidden')flush();};
  window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('pagehide',flush);
  document.addEventListener('visibilitychange',hidden);
  root.addEventListener('reader-before-page-change',flush);
  root.addEventListener('reader-page-change',schedule);
  $('#reader-font',root).onchange=async event=>{
    const anchor=readingTools.captureAnchor(text);text.style.fontFamily=novelFonts[event.target.value]||novelFonts.georgia;
    await readingTools.restoreAnchor(text,anchor);schedule();
  };
  $('#reader-alignment',root).onchange=async event=>{
    const anchor=readingTools.captureAnchor(text);text.style.textAlign=event.target.value;
    await readingTools.restoreAnchor(text,anchor);schedule();
  };
  speechReader=speechTools.createSpeechReader({root,container:text,kind:books.find(book=>book.id===id)?.format,preferences:state.reading[id]?.speech,
    getOffset:()=>readingTools.captureAnchor(text).offset||0,
    nextPage:async()=>{await session.flush();return current()&&formatReader?formatReader.advance():false;},
    onPosition:schedule,flush:()=>session.flush(),onPreferences:schedule,isCurrent:current});
  readingCleanup=()=>{window.clearInterval(heartbeat);window.removeEventListener('scroll',schedule);window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',hidden);root.removeEventListener('reader-before-page-change',flush);root.removeEventListener('reader-page-change',schedule);};
}

/** Validate basic notebook structure without changing the storage schema. */
function validate(data) {
  if (!data || data.version !== 1 || !data.profile || typeof data.profile !== 'object') {
    throw Error('This is not a Picture Book backup.');
  }
  const result = {...structuredClone(defaults), ...data, profile: profileWithDefaults(data.profile)};
  for (const key of ['posts', 'blogs', 'tasks', 'anime', 'documents', 'events']) {
    if (!Array.isArray(result[key]) || result[key].some(record => !record || typeof record !== 'object' || typeof record.id !== 'string' || typeof record.title !== 'string')) {
      throw Error(`Invalid ${key} data.`);
    }
  }
  for (const key of Object.keys(defaults.profile)) {
    if (typeof result.profile[key] !== 'string') throw Error('Invalid profile data.');
  }
  if (!result.reading || typeof result.reading !== 'object') throw Error('Invalid reading data.');
  return result;
}

/** Display a text-only notification for 4.5 seconds. */
function toast(message) {
  const target = $('#toast');
  target.textContent = message;
  target.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { target.style.display = 'none'; }, 4500);
}

/** Load inert HTML templates once. The visible page never depends on this fetch. */
async function loadTemplates() {
  const response = await fetch('../templates/components.html');
  if (!response.ok) throw Error('Could not load the HTML templates.');
  const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
  parsed.querySelectorAll('template[id]').forEach(template => {
    document.body.append(document.importNode(template, true));
  });
}

/** Clone a reusable component. Its tags and labels are authored in HTML. */
function cloneTemplate(id) {
  const template = document.getElementById(id);
  if (!template?.content.firstElementChild) throw Error(`Missing HTML template: ${id}`);
  return template.content.firstElementChild.cloneNode(true);
}

/** Fill a component's data-field slots as plain text (never interpreted HTML). */
function fillFields(root, values) {
  $$('[data-field]', root).forEach(element => {
    const key = element.dataset.field;
    if (Object.hasOwn(values, key)) element.textContent = values[key] ?? '';
  });
  return root;
}

/** Set collection/record metadata on a component's edit button. */
function bindEdit(root, key, id) {
  const button = $('[data-action="edit"]', root);
  button.dataset.key = key;
  button.dataset.id = id;
  button.hidden = !authenticated;
}

/** Apply saved profile values only to marked slots; leave page copy/layout intact. */
function applyProfile() {
  if (!profileOverrides) return;
  $$('[data-profile]').forEach(element => {
    element.textContent = state.profile[element.dataset.profile] ?? '';
  });
  const cover = $('#music-cover');
  if (cover) {
    const savedCover = state.profile.musicCover && safeURL(state.profile.musicCover);
    const validCover = savedCover && savedCover !== '#';
    cover.src = validCover ? savedCover : initialMusicCover;
    cover.alt = validCover ? `Thumbnail for ${state.profile.song}` : 'Music artwork';
  }
  const listenLink = $('#music-listen');
  if (listenLink) {
    const destination = safeURL(state.profile.musicUrl);
    listenLink.hidden = !state.profile.musicUrl || destination === '#';
    listenLink.href = destination;
  }
  const name = state.profile.name;
  const wordmark = $('.wordmark-name');
  if (wordmark) {
    const suffix = $('.logo-suffix', wordmark);
    const letters = Array.from(name, (letter, index) => {
      const span = document.createElement('span');
      span.className = 'logo-char';
      span.style.setProperty('--order', index);
      span.textContent = letter === ' ' ? '\u00a0' : letter;
      return span;
    });
    wordmark.replaceChildren(...letters, ...(suffix ? [suffix] : []));
    $('.wordmark').setAttribute('aria-label', `${name}’s Picture Book — home`);
  }
}

/** Refresh the existing text clock without recreating its surrounding HTML. */
function tick() {
  const clock = $('#clock');
  if (clock) clock.textContent = new Date().toLocaleString('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  }) + ' · ICT';
}

/** Fill a cloned note/blog card. Full page entries show all text. */
function entryCard(record, key, full = false) {
  const body = String(record.body || '');
  const card = fillFields(cloneTemplate('entry-template'), {
    title: record.title,
    date: `${dateLabel(record.date)}${record.category ? ' · ' + record.category : ''}`,
    body: full || body.length <= 240 ? body : body.slice(0, 240) + '…',
    tags: record.tags || 'a little piece of life'
  });
  $('[data-field="body"]', card).classList.toggle('full-entry', full);
  bindEdit(card, key, record.id);
  return card;
}

/** Replace just a data list, or show its HTML-authored empty state. */
function showRecords(target, records, makeCard, emptyId, hasRecords = false) {
  target.replaceChildren(...records.map(makeCard));
  if (!records.length) target.append(cloneTemplate(hasRecords ? 'no-results' : emptyId));
}

/** Filter daily notes or blog records using the existing page controls. */
function renderEntries() {
  const key = page === 'blog' ? 'blogs' : 'posts';
  const query = $('#entry-search').value.toLowerCase();
  const category = $('#entry-filter')?.value;
  const records = state[key].filter(record => (!category || record.category === category) &&
    `${record.title} ${record.body} ${record.tags}`.toLowerCase().includes(query));
  showRecords($('#entries'), records, record => entryCard(record, key, true), `empty-${key}`, state[key].length > 0);
}

/** Filter and fill resource-link cards. */
function renderDocuments() {
  const query = $('#doc-search').value.toLowerCase();
  const records = state.documents.filter(record => `${record.title} ${record.folder}`.toLowerCase().includes(query));
  showRecords($('#documents'), records, record => {
    const card = fillFields(cloneTemplate('document-template'), {...record, folder: record.folder || 'Unsorted'});
    $('[data-document-link]', card).href = safeURL(record.url);
    bindEdit(card, 'documents', record.id);
    return card;
  }, 'empty-documents', state.documents.length > 0);
}

/** Update the three task lists without replacing the board or its headings. */
function renderTasks() {
  $$('[data-task-column]').forEach(column => {
    const status = column.dataset.taskColumn;
    const records = state.tasks.filter(record => record.status === status);
    $('[data-task-count]', column).textContent = `(${records.length})`;
    $('[data-task-empty]', column).hidden = records.length > 0;
    $('[data-task-list]', column).replaceChildren(...records.map(record => {
      const card = fillFields(cloneTemplate('task-template'), {...record, due: record.due ? 'Due ' + dateLabel(record.due) : ''});
      const select = $('[data-task]', card);
      select.dataset.task = record.id;
      select.value = status;
      bindEdit(card, 'tasks', record.id);
      return card;
    }));
  });
}

/** Filter the anime list and fill heart scores, progress, and spoiler labels. */
function renderAnime() {
  const query = $('#anime-search').value.toLowerCase();
  const status = $('#anime-filter').value;
  const records = state.anime.filter(record => (!status || record.status === status) &&
    `${record.title} ${record.body}`.toLowerCase().includes(query));
  showRecords($('#anime-list'), records, record => {
    const rating = Math.min(5, Math.max(0, Math.trunc(Number(record.rating) || 0)));
    const card = fillFields(cloneTemplate('anime-template'), {
      ...record, rating: '♥'.repeat(rating) + '♡'.repeat(5 - rating),
      episodes: `${record.episodes || 0} episodes watched`,
      'spoiler-label': record.spoilers ? 'My thoughts · spoilers inside' : 'My thoughts'
    });
    $('[data-field="rating"]', card).setAttribute('aria-label', `${rating} out of 5 hearts`);
    bindEdit(card, 'anime', record.id);
    return card;
  }, 'empty-anime', state.anime.length > 0);
}

/** Fetch archive data and fill cloned timeline entries. */
async function renderArchive() {
  try {
    const response = await fetch('../data/changelog.json');
    if (!response.ok) throw Error('Archive unavailable');
    const versions = await response.json();
    $('#timeline').replaceChildren(...versions.map(version => {
      const card = fillFields(cloneTemplate('version-template'), {
        ...version, 'version-date': `${version.date} · ${version.version}`
      });
      $('[data-changes]', card).replaceChildren(...version.changes.map(change => {
        const item = document.createElement('li');
        item.textContent = change;
        return item;
      }));
      $('[data-version-link]', card).href = safeURL('../' + version.notes);
      return card;
    }));
  } catch {
    $('#timeline').replaceChildren(cloneTemplate('archive-error'));
  }
}

/** Refresh data slots for this page, preserving static layout and event bindings. */
function refreshPage() {
  applyProfile();
  renderCalendar();
  if (page === 'index') {
    $('#starter-note').hidden = state.posts.length > 0;
    $('#home-posts').replaceChildren(...state.posts.slice(0, 3).map(record => entryCard(record, 'posts')));
  }
  if (page === 'posts' || page === 'blog') renderEntries();
  if (page === 'documents') renderDocuments();
  if (page === 'work') renderTasks();
  if (page === 'anime') renderAnime();
  applyAuthorization();
}

function applyAuthorization() {
  if(!authenticated)speechReader?.stop('Sign in again to use read-aloud.',false);
  if(!authenticated){hideBookPreview();for(const cached of bookCoverCache.values())if(cached.url)URL.revokeObjectURL(cached.url);bookCoverCache.clear();}
  document.body.dataset.owner = String(authenticated);
  $$('[data-owner-only]').forEach(element => {
    if (!authenticated || !['delete','publication'].includes(element.dataset.action)) element.hidden = !authenticated;
  });
  const ownerActions = ['profile','interests','new-post','new-blog','new-task','new-document','new-anime','edit','logout','trash','backup','delete-event','export','export-public','legacy-export','remove-book','bookmark','font-up','font-down','reader-theme','new-folder','rename-folder','remove-folder','move-book'];
  $$('[data-action]').forEach(button => {
    if (ownerActions.includes(button.dataset.action)) button.hidden = !authenticated;
    if (button.dataset.action === 'login') button.hidden = true;
    if (button.dataset.action === 'day') button.disabled = !authenticated;
  });
  ['#music-url','#music-load','#novel-folder','#novel-files'].forEach(selector => {
    const input = $(selector); if (input) input.disabled = !authenticated;
  });
}

/** Draw only the changing calendar grid; retain its HTML-authored frame and note. */
function renderCalendar() {
  const calendar = $('#calendar');
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  $('.calendar-bar strong', calendar).textContent = calendarDate.toLocaleDateString('en-GB', {month: 'long', year: 'numeric'});
  const grid = $('.calendar', calendar);
  const headings = $$('.day-name', grid);
  const cells = [];
  for (let index = 0; index < new Date(year, month, 1).getDay(); index++) cells.push(cloneTemplate('calendar-blank'));
  for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day++) {
    const date = localDate(new Date(year, month, day));
    const count = state.events.filter(event => event.date === date).length;
    const cell = cloneTemplate('calendar-day');
    cell.textContent = day;
    cell.dataset.date = date;
    cell.disabled = !authenticated;
    cell.classList.toggle('today', date === localDate());
    cell.classList.toggle('has-event', count > 0);
    cell.setAttribute('aria-label', `${dateLabel(date)}${count ? ', ' + count + ' reminders' : ''}`);
    cells.push(cell);
  }
  grid.replaceChildren(...headings, ...cells);
}

/** Validate metadata, save all music fields, and let applyProfile update the card. */
async function displayMusic(metadata, videoId) {
  if (!metadata || ['title', 'author_name', 'thumbnail_url'].some(key =>
    typeof metadata[key] !== 'string' || !metadata[key].trim()) ||
    safeURL(metadata.thumbnail_url) === '#' || !/^[A-Za-z0-9_-]{11}$/.test(videoId || '')) {
    throw Error('The video information is incomplete. Try another link.');
  }
  await saveProfile({...state.profile,
    song: metadata.title,
    artist: metadata.author_name,
    musicCover: metadata.thumbnail_url,
    musicUrl: `https://www.youtube.com/watch?v=${videoId}`
  });
  applyProfile();
  return true;
}

/** Load YouTube metadata from the link input; listening opens YouTube separately. */
function bindAudio() {
  const input = $('#music-url');
  const button = $('#music-load');
  const status = $('#audio-status');

  button.onclick = async () => {
    button.disabled = true;

    try {
      requireOwner();
      // Read the link when the button is clicked.
      const link = input.value.trim();

      if (!link) {
        throw new Error('Paste a YouTube link first.');
      }

      // Convert the link into a URL object.
      const url = new URL(link);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Use an http or https YouTube link.');
      }

      // Extract the video ID from either supported link format.
      let videoId;

      if (url.hostname === 'youtu.be') {
        videoId = url.pathname.split('/')[1];
      } else if (
        ['youtube.com', 'www.youtube.com', 'm.youtube.com']
          .includes(url.hostname)
      ) {
        videoId = url.searchParams.get('v');
      }

      if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
        throw new Error('Use a YouTube watch link or youtu.be link.');
      }

      status.textContent = 'Getting music information…';

      // Ask your own server for the metadata.
      const response = await fetch(
        `/api/music-info?videoId=${encodeURIComponent(videoId)}`
      );

      const metadata = await response.json();
      if (!response.ok) {
        throw new Error(metadata.error || 'Could not load this video. Check the server.');
      }

      // Update the image, title, and channel name.
      await displayMusic(metadata, videoId);
      status.textContent = 'Music of the Day saved for everyone to see. Use Listen on YouTube to play it.';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = !authenticated;
    }
  };
}

/** Open an HTML-authored form. onSubmit(false) leaves it open for corrections. */
function openDialog(title, fieldsId, onSubmit, record = {}, deletion = null) {
  const dialog = $('#editor');
  const form = cloneTemplate('dialog-template');
  $('[data-dialog-title]', form).textContent = title;
  $('[data-dialog-body]', form).append(cloneTemplate(fieldsId));
  for (const [name, value] of Object.entries(record)) {
    const input = form.elements.namedItem(name);
    if (input) input.value = value ?? '';
  }
  if (deletion) {
    const button = $('[data-action="delete"]', form);
    button.hidden = false;
    Object.assign(button.dataset, deletion);
  }
  form.onsubmit = async event => {
    event.preventDefault();
    const button = $('[type="submit"]', form);
    button.disabled = true;
    try {
      const result = await onSubmit(Object.fromEntries(new FormData(form)));
      if (result !== false) { dialog.close(); refreshPage(); }
    } catch (error) { toast(error.message || 'Could not save this page.'); }
    finally { button.disabled = false; }
  };
  dialog.replaceChildren(form);
  if (!dialog.open) dialog.showModal();
  return form;
}

/** Open a shared confirmation template and pass its accepted action through. */
function confirmAction(title, message, label, onConfirm) {
  const form = openDialog(title, 'confirmation-fields', onConfirm);
  $('[data-confirm-message]', form).textContent = message;
  $('[type="submit"]', form).textContent = label;
}

/** Edit the current profile using fields in components.html. */
function editProfile() {
  requireOwner();
  openDialog('Make yourself at home', 'profile-fields', async data => {
    return saveProfile({...state.profile, ...data, is_public: data.is_public === 'true'});
  }, state.profile);
}

function editInterests() {
  requireOwner();
  openDialog('In my little world', 'interests-fields', data => saveProfile({...state.profile, ...data}), state.profile);
}

/** Create or edit a supported server record; commit before updating page state. */
function editEntry(key, id) {
  requireOwner();
  const kinds = {
    posts: ['A little moment', 'post-fields'], blogs: ['A page of words', 'blog-fields'],
    tasks: ['One thing to do', 'task-fields'], documents: ['A material to keep', 'document-fields'],
    anime: ['After the end credits', 'anime-fields']
  };
  if (!kinds[key]) return;
  const old = state[key].find(record => record.id === id);
  const record = {date: localDate(), rating: '3', episodes: '0', ...old};
  if (key === 'anime') record.spoilers = old?.spoilers ? 'Yes' : 'No';
  const form = openDialog(...kinds[key], async data => {
    if (key === 'documents' && safeURL(data.url) === '#') {
      toast('Please use an http or https link.');
      return false;
    }
    if (key === 'anime') data.spoilers = data.spoilers === 'Yes';
    await saveRecord(key, data, old);
    return true;
  }, record, old ? {key, id} : null);
  if (old && ['posts','blogs','anime'].includes(key)) {
    const publish = $('[data-action="publication"]', form);
    publish.hidden = false;
    Object.assign(publish.dataset, {key, id, publication: old.publication_state === 'published' ? 'unpublish' : 'publish'});
    publish.textContent = old.publication_state === 'published' ? 'Unpublish' : 'Publish saved version';
    if (old.publication_state === 'published') $('[type="submit"]', form).textContent = 'Save published changes';
  }
}

/** Open reminder form and fill the existing reminders for the requested ISO date. */
function editDay(date) {
  requireOwner();
  const form = openDialog(dateLabel(date), 'reminder-fields', async data => {
    await saveRecord('events', {title: data.title, date});
    return true;
  });
  $('[data-event-list]', form).replaceChildren(...state.events.filter(record => record.date === date).map(record => {
    const item = fillFields(cloneTemplate('reminder-template'), record);
    Object.assign($('[data-action="delete-event"]', item).dataset, {id: record.id, date});
    return item;
  }));
}

/** Resolve relative website links; reject local-file and executable schemes. */
function safeURL(url) {
  try {
    const parsed = new URL(url, location.href);
    if (['https:', 'http:'].includes(parsed.protocol)) return parsed.href;
  } catch { /* Return a harmless destination on malformed input. */ }
  return '#';
}

let weatherRequest = 0;
let weatherPlace;

function weatherLoading() {
  const loading = cloneTemplate('loading-template');
  // The template root IS the message; querySelector cannot select its root.
  loading.textContent = 'Looking outside…';
  $('#weather').replaceChildren(loading);
}

/** Error recovery includes manual place selection, independent of geolocation. */
function weatherError(message) {
  const panel = fillFields(cloneTemplate('weather-error'), {message: message || 'Weather is unavailable right now. Try again or choose another place.'});
  $('#weather').replaceChildren(panel);
}

async function loadWeather(latitude, longitude, name = 'Chosen place') {
  const request = ++weatherRequest;
  weatherLoading();
  try {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw Error('The location was invalid. Choose a place instead.');
    weatherPlace = {latitude, longitude, name};
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({latitude, longitude, current: 'temperature_2m,weather_code', timezone: 'auto', temperature_unit: 'celsius'});
    const response = await fetch(url, {signal: AbortSignal.timeout(12000)});
    if (!response.ok) throw Error('The weather service could not respond. Try again or choose a nearby city.');
    const data = await response.json(), current = data.current;
    if (!current || !Number.isFinite(current.temperature_2m) || !Number.isInteger(current.weather_code)) throw Error('The weather response was incomplete. Please try again.');
    const code = current.weather_code;
    const label = code === 0 ? 'Clear skies' : code <= 3 ? 'A few clouds' : [45,48].includes(code) ? 'Fog outside' : code <= 57 ? 'Drizzle outside' : code <= 67 ? 'Rain outside' : code <= 77 ? 'Snow outside' : code <= 82 ? 'Passing showers' : code <= 86 ? 'Snow showers' : code >= 95 ? 'Stormy skies' : 'Current weather';
    const time = typeof current.time === 'string' ? current.time.match(/T(\d{2}:\d{2})/)?.[1] : null;
    if (request !== weatherRequest) return;
    $('#weather').replaceChildren(fillFields(cloneTemplate('weather-result'), {
      icon: code <= 3 ? '☀' : '☁', temperature: `${Math.round(current.temperature_2m)}°C`,
      label, updated: `${name} · ${time ? 'updated ' + time : 'updated now'}`
    }));
  } catch (error) { if (request === weatherRequest) weatherError(error.message); }
}

/** Browser location is requested only on click; a city can be chosen instead. */
async function getWeather() {
  const request = ++weatherRequest;
  weatherLoading();
  try {
    if (!navigator.geolocation) throw Error('Browser location is unavailable. Choose a city instead.');
    const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, {timeout: 10000, maximumAge: 60000, enableHighAccuracy: true}));
    if (request !== weatherRequest) return;
    const accuracy = position.coords.accuracy;
    const name = Number.isFinite(accuracy) && accuracy >= 1000 ? `Browser location (approx. ${Math.ceil(accuracy / 1000)} km accuracy)` : 'Browser location';
    await loadWeather(position.coords.latitude, position.coords.longitude, name);
  } catch (error) {
    if (request !== weatherRequest) return;
    const message = error.code === 1 ? 'Location permission was denied. Choose a city instead.' : error.code === 3 ? 'Finding your location took too long. Choose a city instead.' : 'Your browser could not find your location. Choose a city instead.';
    weatherError(message);
  }
}

function chooseWeatherPlace() {
  const form = openDialog('Weather for a place', 'weather-place-fields', async data => {
    const query = data.place.trim(), list = $('#weather-matches', form);
    list.replaceChildren();
    if (query.length < 2 || query.length > 100) throw Error('Enter a city or town name (2–100 characters).');
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.search = new URLSearchParams({name: query, count: 5, language: 'en', format: 'json'});
    const response = await fetch(url, {signal: AbortSignal.timeout(12000)});
    if (!response.ok) throw Error('Place search is unavailable. Please try again.');
    const results = (await response.json()).results || [];
    if (!Array.isArray(results)) throw Error('The place search response was invalid.');
    const places = results.filter(place => typeof place.name === 'string' && Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
    if (!places.length) list.textContent = 'No matching place. Try a nearby city or another spelling.';
    for (const place of places) {
      const name = [place.name, place.admin1, place.country].filter(Boolean).join(', ');
      const button = fillFields(cloneTemplate('weather-place-result'), {name});
      button.onclick = async () => { $('#editor').close(); await loadWeather(place.latitude, place.longitude, name); };
      list.append(button);
    }
    return false;
  });
  $('[type="submit"]', form).textContent = 'Search';
}

/** Open the existing version-1 novel database. */
function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('philine-books', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('books', {keyPath: 'id'});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(Error('Local book storage is unavailable.'));
  });
}

/** Legacy migration export only. Never write to the old IndexedDB store. */
async function booksOp(mode, callback) {
  if (mode !== 'readonly') throw Error('Browser storage is now read-only.');
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('books', mode);
    const request = callback(transaction.objectStore('books'));
    transaction.oncomplete = () => { resolve(request?.result); db.close(); };
    transaction.onerror = () => { reject(Error('Could not save your books. Storage may be full.')); db.close(); };
    transaction.onabort = () => { reject(Error('Book storage transaction was interrupted.')); db.close(); };
  });
}

/** Reload only the novel shelf; leave the reader and page layout intact. */
async function loadBooks() {
  try {
    books = [];
    libraryFolders = authenticated ? await apiRequest('/api/me/folders') : [];
    if (authenticated) {
      for (let offset = 0;; offset += 500) {
        const batch = await apiRequest(`/api/me/records/books?limit=500&offset=${offset}`);
        books.push(...batch);
        if (batch.length < 500) break;
      }
    }
    books.sort((a, b) => a.title.localeCompare(b.title, undefined, {numeric: true}));
    const select = $('#library-folder');
    if (selectedFolder && selectedFolder !== 'unfiled' && !libraryFolders.some(f => f.id === selectedFolder)) selectedFolder = '';
    select.replaceChildren(newOption('All books', ''), newOption('Unfiled books', 'unfiled'), ...libraryFolders.map(f => newOption('▱ ' + f.title, f.id)));
    select.value = selectedFolder;
    showShelf();
  } catch (error) { $('#book-list').textContent = error.message; }
}

function newOption(title, value) {
  const option = document.createElement('option'); option.textContent = title; option.value = value; return option;
}

function editLibraryFolder(rename = false) {
  requireOwner();
  const folder = rename ? libraryFolders.find(f => f.id === selectedFolder) : null;
  if (rename && !folder) return;
  openDialog(rename ? 'Rename series folder' : 'A folder for your series', 'folder-fields', async data => {
    const result = await apiRequest('/api/me/folders' + (folder ? '/' + folder.id : ''), folder ? 'PUT' : 'POST', {...data, ...(folder ? {revision: folder.revision} : {})});
    selectedFolder = result.id; await loadBooks(); return true;
  }, folder || {});
}

function editBookFolder(id = activeBook) {
  requireOwner();
  const book = books.find(b => b.id === id);
  if (!book) return;
  openDialog('Organize this volume', 'book-folder-fields', async data => {
    const updated = await apiRequest('/api/me/records/books/' + book.id, 'PUT', {...book, title: data.title, folderId: data.folderId || null});
    const heading = $('[data-field="title"]', $('#reader')); if (heading && activeBook === book.id) heading.textContent = updated.title;
    await loadBooks(); return true;
  }, book);
  const select = $('#book-folder-choice', $('#editor'));
  select.replaceChildren(newOption('Unfiled books', ''), ...libraryFolders.map(f => newOption(f.title, f.id)));
  select.value = book.folderId || '';
}

/** Filter the in-memory shelf and clone a button per visible book. */
function showShelf() {
  hideBookPreview();
  const query = $('#book-search').value.toLowerCase();
  $('#rename-folder').disabled = !libraryFolders.some(f => f.id === selectedFolder);
  $('#remove-folder').disabled = $('#rename-folder').disabled;
  const records = books.filter(book => book.title.toLowerCase().includes(query) && (!selectedFolder || (selectedFolder === 'unfiled' ? !book.folderId : book.folderId === selectedFolder)));
  showRecords($('#book-list'), records, book => {
    const button = fillFields(cloneTemplate('book-template'), {
      title: '♧ ' + book.title + ' · ' + book.format.toUpperCase(),
      progress: (libraryFolders.find(f => f.id === book.folderId)?.title || 'Unfiled') + ' · ' + (state.reading[book.id] ? Math.round(state.reading[book.id].progress || 0) + '% read' : 'A fresh page')
    });
    button.dataset.id = book.id;
    $('[data-action="read-book"]',button).dataset.id=book.id;
    button.onmouseenter=()=>previewBookCover(book,button);
    button.onmouseleave=hideBookPreview;
    button.onfocusin=()=>previewBookCover(book,button);
    button.onfocusout=event=>{if(!button.contains(event.relatedTarget))hideBookPreview();};
    button.onclick=hideBookPreview;
    button.onkeydown=event=>{if(event.key==='Escape')hideBookPreview();};
    return button;
  }, 'empty-books', books.length > 0);
}

/** Upload originals to the selected series, preserving directory groupings. */
async function importBooks(event) {
  requireOwner();
  if (uploadingBooks) return;
  const files = Array.from(event.target.files || []).filter(file => /\.(txt|md|pdf|epub)$/i.test(file.name));
  if (!files.length) return toast('Choose PDF, EPUB, TXT, or Markdown files.');
  uploadingBooks = true;
  const destination = libraryFolders.find(f => f.id === selectedFolder)?.id || null;
  let count = 0;
  try {
    for (const file of files) {
      const format = file.name.split('.').pop().toLowerCase();
      const binary = ['pdf', 'epub'].includes(format);
      const limit = (binary ? 50 : 10) * 1024 * 1024;
      if (!file.size || file.size > limit) throw Error(`${file.name}: choose a nonempty file up to ${binary ? 50 : 10} MiB.`);
      $('#library-status').textContent = `Uploading ${count + 1} of ${files.length}: ${file.name}`;
      const sourcePath = file.webkitRelativePath || file.name;
      let folderId = destination;
      const directory = sourcePath.split('/').slice(0, -1).join(' / ');
      if (!folderId && selectedFolder !== 'unfiled' && directory) {
        let folder = libraryFolders.find(f => f.title === directory);
        if (!folder) { folder = await apiRequest('/api/me/folders', 'POST', {title: directory}); libraryFolders.push(folder); }
        folderId = folder.id;
      }
      const data = {title: file.name.replace(/\.(txt|md|pdf|epub)$/i, ''), sourcePath, format, folderId};
      if (binary) {
        const params = new URLSearchParams({...data, folderId: folderId || ''});
        const response = await fetch('/api/me/books/upload?' + params, {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': format === 'pdf' ? 'application/pdf' : 'application/epub+zip'}, body: file});
        const result = await response.json();
        if (!response.ok) {
          if (response.status === 401) { authenticated = false; applyAuthorization(); }
          throw Error(result.error || 'Upload failed.');
        }
      } else await apiRequest('/api/me/records/books', 'POST', {...data, text: await file.text()});
      count++;
    }
    $('#library-status').textContent = `${count} volumes saved to your private library.`;
    toast(`${count} stories added to your shelf.`);
    await loadBooks();
  } catch (error) {
    $('#library-status').textContent = `${count} books saved. ${error.message} Remaining files were not uploaded.`;
    toast(`${count} books saved before the upload stopped. ${error.message}`);
    await loadBooks();
  }
  event.target.value = '';
  uploadingBooks = false;
}

/** Populate the HTML reader component with escaped-by-textContent book text. */
async function readBook(id) {
  requireOwner();
  const book = books.find(record => record.id === id);
  if (!book) return;
  const pendingClose=closeBookReader();
  const token = bookOpenToken;
  await pendingClose;
  if(token!==bookOpenToken)return;
  const binary = ['pdf', 'epub'].includes(book.format);
  const content = binary ? {text: 'Opening your book…'} : await apiRequest(`/api/me/books/${id}/content`);
  if (token !== bookOpenToken) return;
  activeBook = id;
  const saved = state.reading[id] || {};
  [readingTools,speechTools]=await Promise.all([import('./reading-position.mjs'),import('./reader-speech.mjs')]);
  if(token!==bookOpenToken)return;
  const reader = fillFields(cloneTemplate('reader-template'), {...book, text: content.text});
  const text = $('.reader-text', reader);
  text.style.fontSize = Math.min(30, Math.max(14, Number(saved.font) || 18)) + 'px';
  text.style.fontFamily=novelFonts[saved.fontFamily]||novelFonts.georgia;
  $('#reader-font',reader).value=saved.fontFamily||'georgia';
  $('#reader-font',reader).disabled=book.format==='pdf';
  text.style.textAlign=saved.alignment||'left';
  $('#reader-alignment',reader).value=saved.alignment||'left';
  $('#reader-alignment',reader).disabled=book.format==='pdf';
  if (saved.progress) $('#bookmark-status', reader).textContent = `Returning to ${Math.round(saved.progress)}% of this story.`;
  $('#reader').replaceChildren(reader);
  applyAuthorization();
  $('#reader').classList.toggle('dark', saved.theme === 'dark');
  if (binary) {
    const link = $('#book-download'); link.hidden = false; link.href = `/api/me/books/${id}/file`; link.download = book.title + '.' + book.format;
    try {
      const module = await import('./novel-formats.mjs');
      if (token !== bookOpenToken) return;
      const controller = await module.openFormatReader({book, container: text, root: $('#reader'), saved, isCurrent: () => token === bookOpenToken});
      if (token !== bookOpenToken) { controller?.destroy(); return; }
      formatReader = controller;
      await readingTools.restoreAnchor(text,saved.anchor);
      if(token===bookOpenToken)startReadingSession(id,$('#reader'),text,token);
    } catch (error) { if (token === bookOpenToken) text.textContent = 'Could not open this book. ' + error.message; }
    return;
  }
  if(saved.anchor&&Object.keys(saved.anchor).length)await readingTools.restoreAnchor(text,saved.anchor);
  else if (saved.progress) requestAnimationFrame(() => {
    window.scrollTo(0, window.scrollY + text.getBoundingClientRect().top + (text.offsetHeight - window.innerHeight) * saved.progress / 100);
  });
  if(token===bookOpenToken)startReadingSession(id,$('#reader'),text,token);
}

/** Download a generated payload and release the temporary object URL. */
function download(name, data, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([data], {type}));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Open backup controls from HTML and wire the restore file input. */
function backupDialog() {
  requireOwner();
  const dialog = $('#editor');
  dialog.replaceChildren(cloneTemplate('backup-template'));
  applyAuthorization();
  if (!dialog.open) dialog.showModal();
  $('#restore-file').onchange = prepareRestore;
}

/** Browse recoverable server records without loading book text. */
async function trashDialog() {
  requireOwner();
  const dialog = $('#editor');
  dialog.replaceChildren(cloneTemplate('trash-template'));
  if (!dialog.open) dialog.showModal();
  const select = $('#trash-collection'), list = $('#trash-list');
  let offset = 0;
  async function draw() {
    list.replaceChildren();
    const key = select.value;
    const records = await apiRequest(`/api/me/records/${key}?trash=true&limit=100&offset=${offset}`);
    for (const record of records) {
      const item = fillFields(cloneTemplate('trash-item-template'), record);
      $('[data-restore-item]', item).onclick = async event => {
        event.target.disabled = true;
        try {
          await apiRequest(`/api/me/records/${key}/${record.id}/restore`, 'POST', {revision: record.revision});
          await loadNotebook(); refreshPage();
          if (page === 'novels') await loadBooks();
          await draw();
        } catch (error) { toast(error.message); event.target.disabled = false; }
      };
      list.append(item);
    }
    $('#trash-prev').disabled = offset === 0;
    $('#trash-next').disabled = records.length < 100;
    if (!records.length) list.textContent = 'No deleted records in this section.';
  }
  select.onchange = () => { offset = 0; draw().catch(error => toast(error.message)); };
  $('#trash-prev').onclick = () => { offset = Math.max(0, offset - 100); draw().catch(error => toast(error.message)); };
  $('#trash-next').onclick = () => { offset += 100; draw().catch(error => toast(error.message)); };
  await draw();
}

/** Preview the exact backup on the server, then commit only that signed preview. */
async function prepareRestore(event) {
  const preview = $('#restore-preview');
  preview.replaceChildren();
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 60 * 1024 * 1024) throw Error('Backup exceeds the 60 MiB upload limit.');
    const data = JSON.parse(await file.text());
    const source = $('#import-source').value.trim();
    const result = await apiRequest('/api/me/import/preview', 'POST', {source, backup: data});
    const panel = cloneTemplate('restore-preview-template');
    $('[data-restore-counts]', panel).textContent = Object.entries(result.counts).map(([key,count]) => `${count} ${key}`).join(', ') + '. ' + result.message;
    $('#restore-confirm', panel).onclick = async () => {
      const button = $('#restore-confirm', panel);
      button.disabled = true;
      try {
        await apiRequest('/api/me/import/commit', 'POST', {backup: data, token: result.token});
        await loadNotebook();
        $('#editor').close();
        refreshPage();
        if (page === 'novels') { closeBookReader(); activeBook = undefined; await loadBooks(); $('#reader').replaceChildren(originalReader.cloneNode(true)); }
        toast('Your picture book is saved on the server.');
      } catch (error) { toast(error.message); }
      finally { button.disabled = false; }
    };
    preview.append(panel);
  } catch (error) { toast(error.message || 'That backup could not be read.'); }
}

const originalReader = $('#reader')?.firstElementChild?.cloneNode(true);

/** Handle declarative data-action buttons in static pages and cloned components. */
async function handleAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const {action, key, id} = button.dataset;
  const types = {'new-post': 'posts', 'new-blog': 'blogs', 'new-task': 'tasks', 'new-document': 'documents', 'new-anime': 'anime'};
  if (action === 'close') return $('#editor').close();
  if (action === 'logout') {
    await apiRequest('/api/auth/logout', 'POST', {});
    location.reload(); return;
  }
  if (types[action]) return editEntry(types[action]);
  if (action === 'profile') return editProfile();
  if (action === 'interests') return editInterests();
  if (action === 'edit') return editEntry(key, id);
  if (action === 'delete') return confirmAction('Move this page to trash?', 'You can restore it from Trash.', 'Move to trash', async () => {
    return trashRecord(key, id);
  });
  if (action === 'delete-event') {
    await trashRecord('events', id);
    editDay(button.dataset.date);
    return renderCalendar();
  }
  if (action === 'month-prev' || action === 'month-next') {
    calendarDate.setMonth(calendarDate.getMonth() + (action === 'month-next' ? 1 : -1));
    return renderCalendar();
  }
  if (action === 'day') return editDay(button.dataset.date);
  if (action === 'weather') return getWeather();
  if (action === 'weather-place') return chooseWeatherPlace();
  if (action === 'weather-refresh') return weatherPlace ? loadWeather(weatherPlace.latitude, weatherPlace.longitude, weatherPlace.name) : getWeather();
  if (action === 'backup') return backupDialog();
  if (action === 'publication') return confirmAction(
    button.dataset.publication === 'publish' ? 'Publish saved content?' : 'Unpublish this page?',
    'This changes the visibility of the saved version. Unsaved form changes are not included.',
    button.dataset.publication === 'publish' ? 'Publish' : 'Unpublish', async () => {
      requireOwner();
      const old = state[key].find(record => record.id === id);
      const updated = await apiRequest(`/api/me/records/${key}/${id}/${button.dataset.publication}`, 'POST', {revision: old.revision});
      state[key] = state[key].map(record => record.id === id ? updated : record);
    });
  if (action === 'trash') return trashDialog();
  if (action === 'legacy-export') {
    const saved = localStorage.getItem('philine-picturebook-v1');
    if (!saved) throw Error('No old notebook was found on this browser origin. Try the host and port you used before.');
    const oldBooks = await booksOp('readonly', store => store.getAll());
    download(`picturebook-browser-backup-${localDate()}.json`, JSON.stringify({notebook: JSON.parse(saved), books: oldBooks}, null, 2));
    return toast('Old browser data exported without changing it.');
  }
  if (action === 'pick') {
    const choices = $('#choices').value.split('\n').map(choice => choice.trim()).filter(Boolean);
    $('#pick-result').textContent = choices.length ? '✿ ' + choices[Math.floor(Math.random() * choices.length)] : 'Add a few choices first.';
  }
  if (action === 'export-public') {
    const {profile, posts, blogs, anime} = await apiRequest('/api/public/notebook');
    download('site-content.js', 'window.PICTUREBOOK_PUBLIC = ' + JSON.stringify({profile, posts, blogs, anime}, null, 2).replace(/</g, '\\u003c') + ';\n', 'text/javascript');
    toast('Public pages exported. Replace data/site-content.js to include them in the site.');
  }
  if (action === 'export') {
    requireOwner();
    const backup = await apiRequest('/api/me/export');
    download(`philine-picturebook-${localDate()}.json`, JSON.stringify(backup, null, 2));
    toast('Your spare copy is ready.');
  }
  if (action === 'read-book') return readBook(id);
  if (action === 'new-folder') return editLibraryFolder();
  if (action === 'rename-folder') return editLibraryFolder(true);
  if (action === 'move-book') return editBookFolder();
  if (action === 'remove-folder') {
    requireOwner();
    const folder = libraryFolders.find(f => f.id === selectedFolder); if (!folder) return;
    return confirmAction('Remove this series folder?', 'Its books will move to Unfiled books. No books or bookmarks will be deleted.', 'Remove folder', async () => {
      await apiRequest(`/api/me/folders/${folder.id}/remove`, 'POST', {revision: folder.revision}); selectedFolder = 'unfiled'; await loadBooks(); return true;
    });
  }
  if (action === 'font-up' || action === 'font-down') {
    const text = $('.reader-text');
    if(books.find(book=>book.id===activeBook)?.format==='pdf')speechReader?.stop('Zoom changed. Press Read aloud to continue.');
    const anchor=readingTools?.captureAnchor(text);
    text.style.fontSize = Math.min(30, Math.max(14, parseInt(text.style.fontSize) + (action === 'font-up' ? 2 : -2))) + 'px';
    await formatReader?.resize?.();
    if(anchor)await readingTools.restoreAnchor(text,anchor);
    readingSession?.schedule();
  }
  if (action === 'reader-theme') {$('#reader').classList.toggle('dark');readingSession?.schedule();}
  if (action === 'bookmark') {
    requireOwner();
    if(readingSession){await readingSession.saveNow();toast('Your place is saved.');showShelf();return;}
    if (['pdf', 'epub'].includes(books.find(book => book.id === activeBook)?.format) && !formatReader) throw Error('Open the book successfully before saving your place.');
    const text = $('.reader-text');
    const top = window.scrollY + text.getBoundingClientRect().top;
    const progress = Math.min(100, Math.max(0, (window.scrollY - top) / Math.max(1, text.offsetHeight - window.innerHeight) * 100));
    const position = formatReader ? formatReader.position() : {progress};
    const data = {...position, font: parseInt(text.style.fontSize), theme: $('#reader').classList.contains('dark') ? 'dark' : 'light'};
    const old = state.reading[activeBook];
    state.reading[activeBook] = await apiRequest(`/api/me/books/${activeBook}/progress`, 'PUT', {...data, ...(old ? {revision: old.revision} : {})});
    $('#bookmark-status').textContent = `A little bookmark at ${Math.round(position.progress)}%.`;
    toast('Your place is saved.');
    showShelf();
  }
  if (action === 'remove-book') return confirmAction('Take this book off the shelf?', 'The server copy moves to trash. Your original file stays in its folder.', 'Move to trash', async () => {
    requireOwner();
    const book = books.find(record => record.id === activeBook);
    await apiRequest(`/api/me/records/books/${activeBook}/trash`, 'POST', {revision: book.revision});
    delete state.reading[activeBook];
    closeBookReader();
    activeBook = undefined;
    await loadBooks();
    $('#reader').replaceChildren(originalReader.cloneNode(true));
    return true;
  });
}

/** Bind persistent page inputs once. Redrawing lists never duplicates listeners. */
function bindPage() {
  document.addEventListener('click', event => {
    handleAction(event).catch(error => toast(error.message || 'This action could not finish.'));
  });
  document.addEventListener('change', async event => {
    const select = event.target.closest('[data-task]');
    if (!select) return;
    const record = state.tasks.find(task => task.id === select.dataset.task);
    if (record) {
      select.disabled = true;
      try { await saveRecord('tasks', {...record, status: select.value}, record); renderTasks(); }
      catch (error) { select.value = record.status; toast(error.message); }
      finally { select.disabled = false; }
    }
  });
  if (page === 'index') bindAudio();
  if (page === 'posts' || page === 'blog') {
    $('#entry-search').oninput = renderEntries;
    if ($('#entry-filter')) $('#entry-filter').onchange = renderEntries;
  }
  if (page === 'documents') $('#doc-search').oninput = renderDocuments;
  if (page === 'anime') {
    $('#anime-search').oninput = renderAnime;
    $('#anime-filter').onchange = renderAnime;
  }
  if (page === 'utilities') $('#count-text').oninput = event => {
    const text = event.target.value;
    $('#count-result').textContent = `${text.trim().split(/\s+/u).filter(Boolean).length} words · ${Array.from(text).length} characters`;
  };
  if (page === 'novels') {
    $('#novel-folder').onchange = importBooks;
    $('#novel-files').onchange = importBooks;
    $('#book-search').oninput = showShelf;
    $('#library-folder').onchange = event => { selectedFolder = event.target.value; showShelf(); };
  }
}

/** Start behaviour after the static page is already visible. */
async function init() {
  tick();
  setInterval(tick, 30000);
  try {
    await loadTemplates();
    bindPage();
    await loadNotebook();
    refreshPage();
    if (page === 'archive') await renderArchive();
    if (page === 'novels') await loadBooks();
  } catch (error) {
    authenticated = false;
    applyAuthorization();
    toast(`${error.message} Start the configured server to use notebook features.`);
  }
}

init();
