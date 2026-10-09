import './style.css';
import * as pdfjs from 'pdfjs-dist';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc=worker;
const pdfOptions={wasmUrl:'/pdfjs/wasm/',standardFontDataUrl:'/pdfjs/standard_fonts/',cMapUrl:'/pdfjs/cmaps/',cMapPacked:true};
const app=document.querySelector('#app');
const icon='<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 6q7-2 12 2 5-4 12-2v21q-7-2-12 2-5-4-12-2zM16 8v21"/></svg>';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let db,books=[],active=null,pdf=null,renderTask=null,epoch=0,filter='all',query='',busy=false;
let theme=localStorage.getItem('sayfa-theme')||'paper';
const request=indexedDB.open('sayfa',2);request.onupgradeneeded=()=>{const database=request.result;if(!database.objectStoreNames.contains('books'))database.createObjectStore('books',{keyPath:'id'});if(!database.objectStoreNames.contains('files'))database.createObjectStore('files',{keyPath:'id'});const existing=request.transaction.objectStore('books');existing.openCursor().onsuccess=e=>{const cursor=e.target.result;if(!cursor)return;const b=cursor.value;if(b.data){request.transaction.objectStore('files').put({id:b.id,data:b.data});delete b.data;cursor.update(b)}cursor.continue()}};
const ready=new Promise((resolve,reject)=>{request.onsuccess=()=>{db=request.result;resolve()};request.onerror=()=>reject(request.error)});
async function store(mode,fn){await ready;return new Promise((resolve,reject)=>{const tx=db.transaction('books',mode);const r=fn(tx.objectStore('books'));tx.oncomplete=()=>resolve(r.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
async function save(b){await ready;if(b.data&&!b.fileStored){await new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put({id:b.id,data:b.data});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});b.fileStored=true}const {data,...metadata}=b;return store('readwrite',s=>s.put(metadata))}
function toast(message){document.querySelector('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.setAttribute('role','status');el.textContent=message;document.body.append(el);setTimeout(()=>el.remove(),4500)}
function status(b){return b.page>=b.total?'done':b.page>1?'reading':'new'}
function header(){return `<header><a class="brand" href="#" aria-label="Kitaplığa dön">${icon}<span>sayfa<span class="brand-dot">.</span></span></a><span class="header-note">KENDİ OKUMA KÖŞEN</span><button class="install-help" aria-label="Adres çubuğu olmadan aç">Ana ekrana ekle</button><button class="theme-button" title="Temayı değiştir" aria-label="Temayı değiştir">${theme==='night'?'☀':'☾'}</button></header>`}
function applyTheme(){document.documentElement.dataset.theme=theme;localStorage.setItem('sayfa-theme',theme)}
function bindHeader(){document.querySelector('.install-help').onclick=showInstallHelp;document.querySelector('.brand').onclick=e=>{e.preventDefault();library()};document.querySelector('.theme-button').onclick=()=>{theme=theme==='night'?'paper':'night';applyTheme();document.querySelector('.theme-button').textContent=theme==='night'?'☀':'☾'}}
async function library(){await exitReadingFullscreen();epoch++;active=null;if(renderTask){renderTask.cancel();renderTask=null}if(pdf){await pdf.loadingTask.destroy();pdf=null}books=await store('readonly',s=>s.getAll());paintLibrary();upgradeCovers(books)}
function paintLibrary(){const reading=books.filter(b=>status(b)==='reading');const recent=[...books].filter(b=>b.lastRead).sort((a,b)=>b.lastRead-a.lastRead)[0];app.innerHTML=header()+`<main class="library"><div class="intro"><div><p class="eyebrow">BİRAZ YAVAŞLA, BİR SAYFA AÇ.</p><h1>Senin kitaplığın.</h1><p class="muted">Güzel hikâyeler, kaldığın yerde seni bekler.</p></div><button class="primary add">＋ Kitap ekle</button></div><section class="welcome"><div class="welcome-copy"><span class="eyebrow">${recent?'KALDIĞIN YERDEN':'KENDİNE BİR OKUMA MOLASI VER'}</span><h2>${recent?esc(recent.title):'Bir kitabın içinde<br>kaybolmaya ne dersin?'}</h2><p>${recent?`${recent.total} sayfalık hikâyenin ${recent.page}. sayfasındasın.`:'PDF’lerini buraya bırak. Kitabını aç, dünyayı biraz sessize al.'}</p><button class="text-button" id="continue">${recent?'Okumaya devam et':'İlk kitabını ekle'} <span>↗</span></button></div><div class="book-art" aria-hidden="true">${recent?.cover?`<img class="recent-cover" src="${recent.cover}" alt="">`:`<div class="art-shadow"></div><div class="art-book"><span>SAYFALAR<br>ARASINDA</span><i>Her sayfa yeni bir yer.</i><div class="art-arch"></div><small>SENİN HİKÂYEN</small></div><div class="art-note">bir fincan kahve,<br>birkaç güzel sayfa.</div>`}</div></section><div class="collection-heading"><h2>Kitaplarım <span>${books.length}</span></h2><div class="stats">${reading.length} okunuyor <span>·</span> ${books.filter(b=>status(b)==='done').length} tamamlandı</div></div><div class="toolbar"><div class="tabs">${[['all','Tüm kitaplar'],['reading','Okuduklarım'],['done','Bitirdiklerim']].map(([v,t])=>`<button data-filter="${v}" class="${filter===v?'selected':''}">${t}</button>`).join('')}</div><input id="search" type="search" placeholder="Kitaplığında ara…" aria-label="Kitap ara" value="${esc(query)}"></div><div id="grid" class="grid"></div><footer><span>${icon} Her gün, bir sayfa daha.</span><span>Kitapların ve ilerlemen bu tarayıcıda saklanır.</span></footer></main><input hidden id="upload" type="file" accept="application/pdf,.pdf" multiple>`;bindHeader();document.querySelector('.add').onclick=()=>document.querySelector('#upload').click();document.querySelector('#upload').onchange=e=>upload(e.target.files);document.querySelector('#continue').onclick=()=>recent?openBook(recent.id):document.querySelector('#upload').click();document.querySelectorAll('[data-filter]').forEach(el=>el.onclick=()=>{filter=el.dataset.filter;paintLibrary()});document.querySelector('#search').oninput=e=>{query=e.target.value;paintGrid()};paintGrid();app.ondragover=e=>{e.preventDefault()};app.ondrop=e=>{e.preventDefault();upload(e.dataTransfer.files)}}
function paintGrid(){const list=books.filter(b=>(filter==='all'||status(b)===filter)&&b.title.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')));document.querySelector('#grid').innerHTML=list.map((b,i)=>`<article class="book-card"><button class="cover cover-${i%4}" data-open="${b.id}" aria-label="${esc(b.title)} kitabını aç">${b.cover?`<img src="${b.cover}" alt="${esc(b.title)} — PDF kapağı">`:`<span>${esc(b.title)}</span>`}<span class="cover-badge">${status(b)==='done'?'BİTTİ':status(b)==='reading'?'OKUNUYOR':'YENİ'}</span><span class="cover-open">Kitabı aç ↗</span></button><div class="book-details"><h3>${esc(b.title)}</h3><button class="delete" data-delete="${b.id}" aria-label="${esc(b.title)} kitabını sil">×</button><p>${b.total} sayfa <span>·</span> ${Math.round(b.page/b.total*100)}% tamamlandı</p><div class="progress"><i style="width:${b.page/b.total*100}%"></i></div><small>Sayfa ${b.page} / ${b.total}</small></div></article>`).join('')+`<button class="upload-card" id="grid-add"><span>＋</span><strong>Yeni bir hikâye ekle</strong><small>PDF seç veya buraya sürükle</small></button>`;document.querySelector('#grid-add').onclick=()=>document.querySelector('#upload').click();document.querySelectorAll('[data-open]').forEach(el=>el.onclick=()=>openBook(el.dataset.open));document.querySelectorAll('[data-delete]').forEach(el=>el.onclick=async()=>{if(confirm('Bu kitap ve notları bu cihazdan silinsin mi?')){await store('readwrite',s=>s.delete(el.dataset.delete));await new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').delete(el.dataset.delete);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});library()}})}
async function upload(files){if(busy)return;busy=true;for(const file of files){let doc;try{if(!/\.pdf$/i.test(file.name))throw Error('Lütfen bir PDF dosyası seç.');if(file.size>150*1024*1024)throw Error('Bu kitap çok büyük. En fazla 150 MB PDF ekleyebilirsin.');toast('Kitabın hazırlanıyor…');const data=await file.arrayBuffer();doc=await pdfjs.getDocument({...pdfOptions,data:new Uint8Array(data.slice(0))}).promise;const p=await doc.getPage(1);const viewport=p.getViewport({scale:480/p.getViewport({scale:1}).width});const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;await p.render({canvasContext:canvas.getContext('2d'),viewport}).promise;await save({id:crypto.randomUUID(),title:file.name.replace(/\.pdf$/i,'').replace(/[_]/g,' '),data,total:doc.numPages,page:1,cover:canvas.toDataURL('image/jpeg',.85),coverVersion:2,notes:{},marks:[],lastRead:0});toast('Kitabın kitaplığa eklendi.')}catch(e){toast(e.name==='QuotaExceededError'?'Cihazında yeterli depolama alanı yok.':e.name==='PasswordException'?'Şifreli PDF desteklenmiyor. Önce şifresini kaldır.':e.message||'PDF açılamadı.')}finally{await doc?.loadingTask.destroy()}}busy=false;if(!active)await library()}
async function openBook(id){const token=++epoch;try{const b=await store('readonly',s=>s.get(id));if(token!==epoch)return;const file=await new Promise((resolve,reject)=>{const tx=db.transaction('files');const r=tx.objectStore('files').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});if(token!==epoch)return;b.data=file.data;b.fileStored=true;active=b;app.ondrop=null;app.innerHTML=header()+`<main class="reader"><div class="reader-heading"><button id="back" class="text-button">← Kitaplığım</button><h1>${esc(b.title)}</h1><button id="fullscreen" title="Kitabı tam ekran aç" aria-label="Kitabı tam ekran aç" aria-pressed="false">⛶ <span>Tam ekran</span></button></div><div class="reader-tools"><div><button id="bookmark" title="Ayraç ekle">♡ Ayraç</button><button id="notes-toggle">✎ Notlar</button><button id="set-cover">Bu sayfayı kapak yap</button><button id="download-original">Orijinal PDF</button></div><span id="read-status" role="status">Kitabın açılıyor…</span><select id="zoom" aria-label="Yakınlaştırma"><option value="1">Sayfaya sığdır</option><option value="width">Genişliğe sığdır</option><option value="1.25">%125</option><option value="1.5">%150</option><option value="2">%200</option><option value="3">%300</option><option value="4">%400</option></select></div><div class="reading-area"><button id="prev" class="page-arrow" aria-label="Önceki sayfa">‹</button><div class="paper-wrap"><div class="pdf-stream" aria-label="PDF sayfaları"></div></div><button id="next" class="page-arrow" aria-label="Sonraki sayfa">›</button><aside hidden id="notes"><h3>Sayfa notun</h3><p id="note-label"></p><textarea id="note" placeholder="Bu sayfadan aklında kalanlar…" aria-label="Sayfa notu"></textarea><button id="save-note" class="primary">Notu kaydet</button><h3>Ayraçların</h3><div id="marks"></div><h3>Not aldığın sayfalar</h3><div id="note-pages"></div></aside></div><div class="page-controls"><button id="prev-bottom">← Önceki</button><label>Sayfa <input id="page-number" type="number" min="1" max="${b.total}" value="${b.page}" aria-label="Sayfa numarası"> / ${b.total}</label><button id="next-bottom">Sonraki →</button></div><input id="slider" type="range" min="1" max="${b.total}" value="${b.page}" aria-label="Sayfaya git"><p class="reader-tip">Aşağı kaydırarak oku · Tam ekranda çıkış için PDF’ye dokun · Kelimeye dokun: yazılışı ve anlamı · Kaldığın yer kaydedilir</p><button class="pdf-exit" aria-label="Tam ekrandan çık" title="Tam ekrandan çık">×</button></main>`;bindHeader();document.querySelector('.pdf-exit').onclick=async()=>{await exitReadingFullscreen();if(active)render()};document.querySelector('#back').onclick=library;
 document.querySelector('#set-cover').onclick=async()=>{try{const page=await pdf.getPage(b.page);b.cover=await pageCover(page);b.coverVersion=2;await save(b);toast('Bu sayfa kapak olarak kaydedildi.')}catch{toast('Kapak oluşturulamadı.')}};
 document.querySelector('#download-original').onclick=()=>{const url=URL.createObjectURL(new Blob([b.data],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download=b.title+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)};document.querySelector('#fullscreen').onclick=toggleReadingFullscreen;for(const s of ['#prev','#prev-bottom'])document.querySelector(s).onclick=()=>turn(-1);for(const s of ['#next','#next-bottom'])document.querySelector(s).onclick=()=>turn(1);document.querySelector('#page-number').onchange=e=>go(Number(e.target.value));document.querySelector('#slider').onchange=e=>go(Number(e.target.value));document.querySelector('#zoom').value=b.zoom||'1';document.querySelector('#zoom').onchange=()=>{b.zoom=document.querySelector('#zoom').value;save(b);render()};bindContinuousReading();document.querySelector('#notes-toggle').onclick=()=>{document.querySelector('#notes').hidden=!document.querySelector('#notes').hidden;render()};document.querySelector('#note').oninput=e=>{b.notes[b.page]=e.target.value.trim();save(b).catch(()=>toast('Not kaydedilemedi.'))};document.querySelector('#save-note').onclick=async()=>{b.notes[b.page]=document.querySelector('#note').value.trim();await save(b);updateNotes();toast('Notun kaydedildi.')};document.querySelector('#bookmark').onclick=async()=>{b.marks=b.marks.includes(b.page)?b.marks.filter(p=>p!==b.page):[...b.marks,b.page].sort((a,c)=>a-c);await save(b);updateNotes()};pdf=await pdfjs.getDocument({...pdfOptions,data:new Uint8Array(b.data.slice(0))}).promise;if(token!==epoch){await pdf.loadingTask.destroy();pdf=null;return}b.lastRead=Date.now();await save(b);await render();}catch(e){toast('Kitap açılamadı: '+e.message);library()}}
function updateNotes(){if(!active)return;const b=active;document.querySelector('#note-label').textContent=`${b.page}. sayfa`;document.querySelector('#note').value=b.notes[b.page]||'';document.querySelector('#bookmark').textContent=b.marks.includes(b.page)?'♥ Ayraç eklendi':'♡ Ayraç';for(const [selector,pages] of [['#marks',b.marks],['#note-pages',Object.keys(b.notes).filter(p=>b.notes[p]).map(Number)]]){document.querySelector(selector).innerHTML=pages.length?pages.map(p=>`<button data-jump="${p}">Sayfa ${p} ↗</button>`).join(''):'<p class="muted">Henüz eklenmedi.</p>'}document.querySelectorAll('[data-jump]').forEach(el=>el.onclick=()=>go(Number(el.dataset.jump)))}
async function go(page){if(!active||!pdf||!Number.isFinite(page))return;const b=active;const note=document.querySelector('#note');if(note)b.notes[b.page]=note.value.trim();const nextPage=Math.max(1,Math.min(b.total,Math.round(page)));if(nextPage!==b.page)b.position={page:nextPage,x:0,y:0};b.page=nextPage;b.lastRead=Date.now();try{await save(b);if(active===b)await render()}catch(e){toast('İlerlemen kaydedilemedi. Cihaz depolamasını kontrol et.')}}
function turn(delta){if(active)go(active.page+delta)}
let streamGeneration=0,streamKey='',streamObserver=null,streamBusy=false;
function updateReadingStatus(){if(!active)return;updateNotes();document.querySelector('#page-number').value=active.page;document.querySelector('#slider').value=active.page;document.querySelector('#read-status').textContent=`${Math.round(active.page/active.total*100)}% tamamlandı`;for(const selector of ['#prev','#prev-bottom'])document.querySelector(selector).disabled=active.page===1;for(const selector of ['#next','#next-bottom'])document.querySelector(selector).disabled=active.page===active.total;}
async function render(){
 if(!pdf||!active)return;
 const wrap=document.querySelector('.paper-wrap'),stream=wrap?.querySelector('.pdf-stream');if(!stream)return;
 const doc=pdf,b=active,generation=++streamGeneration;streamObserver?.disconnect();streamBusy=true;
 const zoomValue=document.querySelector('#zoom').value;
 const zoom=zoomValue==='width'?1:Number(zoomValue);
 const width=Math.max(100,Math.min(2400,(zoomValue==='width'||document.querySelector('.focus-mode')?wrap.clientWidth-16:Math.min(wrap.clientWidth-16,800))*zoom));
 const position=b.position?.page===b.page?{...b.position}:{page:b.page,x:0,y:0};
 const key=b.id+':'+Math.round(width);
 if(key!==streamKey||!stream.children.length){
  const first=await doc.getPage(1);if(generation!==streamGeneration)return;
  const base=first.getViewport({scale:1});
  stream.replaceChildren();stream.style.width=width+'px';
  const fragment=document.createDocumentFragment();
  for(let i=1;i<=b.total;i++){const slot=document.createElement('div');slot.className='pdf-page';slot.dataset.page=i;slot.style.height=(width*base.height/base.width)+'px';slot.setAttribute('aria-label',i+'. sayfa');fragment.append(slot)}
  stream.append(fragment);streamKey=key;
 }
 const slots=[...stream.children];
 async function draw(slot){
  if(slot.dataset.ready||slot.dataset.loading===String(generation))return;slot.dataset.loading=String(generation);
  try{
   const p=await doc.getPage(Number(slot.dataset.page));if(generation!==streamGeneration)return;
   const base=p.getViewport({scale:1});const height=width*base.height/base.width;
   const anchor=slots[b.page-1],oldOffset=anchor.offsetTop;
   slot.style.height=height+'px';
   if(slot.offsetTop<anchor.offsetTop)wrap.scrollTop+=anchor.offsetTop-oldOffset;
   const ratio=Math.min(devicePixelRatio||1,2,Math.sqrt(8000000/(width*height)));
   const vp=p.getViewport({scale:width/base.width*ratio});const canvas=document.createElement('canvas');
   canvas.width=vp.width;canvas.height=vp.height;canvas.style.width=width+'px';canvas.style.height=height+'px';canvas.setAttribute('aria-label',slot.dataset.page+'. PDF sayfası');
   await p.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
   if(generation!==streamGeneration)return;slot.replaceChildren(canvas);slot.dataset.ready='true';
   try{const content=await p.getTextContent();if(generation!==streamGeneration)return;
    if(content.items.some(item=>item.str?.trim())){const layer=document.createElement('div');layer.className='textLayer';const textViewport=p.getViewport({scale:width/base.width});layer.style.setProperty('--total-scale-factor',textViewport.scale);layer.style.setProperty('--scale-factor',textViewport.scale);slot.append(layer);await new pdfjs.TextLayer({textContentSource:content,container:layer,viewport:textViewport}).render();}
   }catch(e){console.warn('Metin katmanı yüklenemedi',e)}
  }catch(e){if(generation===streamGeneration){slot.textContent='Sayfa yüklenemedi. Yeniden açmayı dene.';console.error(e)}}finally{if(slot.dataset.loading===String(generation))delete slot.dataset.loading;}
 }
 const target=slots[b.page-1];await draw(target);if(generation!==streamGeneration)return;
 wrap.scrollTop=target.offsetTop+Math.max(0,Math.min(.99,position.y||0))*target.offsetHeight;
 wrap.scrollLeft=(position.x||0)*Math.max(0,wrap.scrollWidth-wrap.clientWidth);
 streamBusy=false;updateReadingStatus();
 streamObserver=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting)draw(entry.target);else if(Math.abs(Number(entry.target.dataset.page)-b.page)>3){const canvas=entry.target.querySelector('canvas');if(canvas){canvas.width=0;canvas.height=0;canvas.remove();entry.target.querySelector('.textLayer')?.remove();delete entry.target.dataset.ready}}}},{root:wrap,rootMargin:'500px 0px'});
 slots.forEach(slot=>streamObserver.observe(slot));
}

document.addEventListener('keydown',e=>{if(!active||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))return;if(e.key==='ArrowRight'){e.preventDefault();turn(1)}if(e.key==='ArrowLeft'){e.preventDefault();turn(-1)}});
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(active)render()},200)});
applyTheme();library().catch(()=>{app.innerHTML='<main class="library"><h1>Kitaplık açılamadı</h1><p>Tarayıcında depolamaya izin verip sayfayı yenile.</p></main>'});





async function exitReadingFullscreen(){
 const reader=document.querySelector('.reader');
 if(reader&&document.fullscreenElement===reader)await document.exitFullscreen();
 reader?.classList.remove('focus-mode');
 document.body.classList.remove('reading-fullscreen');
 syncFullscreenButton();
}
function syncFullscreenButton(){const button=document.querySelector('#fullscreen');if(!button)return;const enabled=!!document.querySelector('.reader.focus-mode');button.setAttribute('aria-pressed',String(enabled));button.setAttribute('aria-label',enabled?'Tam ekrandan çık':'Kitabı tam ekran aç');button.title=enabled?'Tam ekrandan çık (Esc)':'Kitabı tam ekran aç';button.innerHTML=enabled?'⛶ <span>Çık</span>':'⛶ <span>Tam ekran</span>';}
async function toggleReadingFullscreen(){
 const reader=document.querySelector('.reader');if(!reader)return;
 if(reader.classList.contains('focus-mode')){await exitReadingFullscreen();if(active)render();return;}
 reader.classList.add('focus-mode');document.body.classList.add('reading-fullscreen');syncFullscreenButton();
 try{if(reader.requestFullscreen&&document.fullscreenEnabled)await reader.requestFullscreen({navigationUI:'hide'});else if(!isInstalled())showInstallHelp();}catch{if(!isInstalled())showInstallHelp();}
 if(active)render();
}
 document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement){document.querySelector('.reader')?.classList.remove('focus-mode');document.body.classList.remove('reading-fullscreen');}syncFullscreenButton();if(active)render();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('.reader.focus-mode'))exitReadingFullscreen().then(()=>{if(active)render()});});



let positionSaveTimer,exitHintTimer;
function bindContinuousReading(){
 const wrap=document.querySelector('.paper-wrap');
 wrap.addEventListener('scroll',()=>document.querySelector('.word-popup')?.remove(),{passive:true});
 wrap.addEventListener('scroll',()=>{
  if(!active||streamBusy)return;
  const slots=wrap.querySelector('.pdf-stream').children;if(!slots.length)return;
  const top=wrap.scrollTop+Math.min(40,wrap.clientHeight*.1);let low=0,high=slots.length-1;
  while(low<high){const middle=Math.ceil((low+high)/2);if(slots[middle].offsetTop<=top)low=middle;else high=middle-1;}
  const slot=slots[low];const b=active;b.page=low+1;b.lastRead=Date.now();b.position={page:b.page,x:wrap.scrollLeft/Math.max(1,wrap.scrollWidth-wrap.clientWidth),y:Math.max(0,(wrap.scrollTop-slot.offsetTop)/slot.offsetHeight)};
  for(const old of wrap.querySelectorAll('.pdf-page[data-ready]')){if(Math.abs(Number(old.dataset.page)-b.page)>3){const c=old.querySelector('canvas');if(c){c.width=0;c.height=0;c.remove()}old.querySelector('.textLayer')?.remove();delete old.dataset.ready}}updateReadingStatus();clearTimeout(positionSaveTimer);positionSaveTimer=setTimeout(()=>save(b).catch(()=>toast('Okuma konumu kaydedilemedi.')),350);
 },{passive:true});
 let start=null;
 wrap.addEventListener('pointerdown',e=>{start={x:e.clientX,y:e.clientY,time:Date.now()};},{passive:true});
 wrap.addEventListener('pointerup',e=>{if(!start||Math.abs(e.clientX-start.x)>12||Math.abs(e.clientY-start.y)>12||Date.now()-start.time>500)return;const word=wordAtPoint(e.clientX,e.clientY);if(word){showWord(word.text,word.rect);start=null;return;}document.querySelector('.word-popup')?.remove();const reader=document.querySelector('.reader');if(reader?.classList.contains('focus-mode')){reader.classList.toggle('controls-visible');clearTimeout(exitHintTimer);exitHintTimer=setTimeout(()=>reader.classList.remove('controls-visible'),2500);}start=null;},{passive:true});
}


async function pageCover(page){const base=page.getViewport({scale:1});const vp=page.getViewport({scale:480/base.width});const canvas=document.createElement('canvas');canvas.width=vp.width;canvas.height=vp.height;await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;return canvas.toDataURL('image/jpeg',.85);}
let upgradingCovers=false;
async function upgradeCovers(list){if(upgradingCovers)return;upgradingCovers=true;try{for(const b of list){if(b.coverVersion===2)continue;let doc;try{const file=await new Promise((resolve,reject)=>{const r=db.transaction('files').objectStore('files').get(b.id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});if(!file)continue;doc=await pdfjs.getDocument({...pdfOptions,data:new Uint8Array(file.data.slice(0))}).promise;const cover=await pageCover(await doc.getPage(1));const current=await store('readonly',s=>s.get(b.id));if(!current||current.coverVersion===2)continue;current.cover=cover;current.coverVersion=2;await save(current);b.cover=cover;b.coverVersion=2;if(!active)paintLibrary();}catch(e){console.warn('Kapak yenilenemedi',e)}finally{await doc?.loadingTask.destroy()}}}finally{upgradingCovers=false}}
function isInstalled(){return matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||navigator.standalone===true}
function showInstallHelp(){
 document.querySelector('.install-dialog')?.remove();const dialog=document.createElement('dialog');dialog.className='install-dialog';dialog.innerHTML='<h2>Adres çubuğu olmadan oku</h2><p>Tarayıcın tam ekranı destekliyorsa Tam ekran düğmesi adres çubuğunu gizler. Desteklemiyorsa siteyi ana ekrandan uygulama gibi açabilirsin.</p><p><strong>iPhone / iPad:</strong> Safari → Paylaş → Ana Ekrana Ekle → Uygulama olarak aç.</p><p><strong>Android:</strong> Chrome menüsü → Ana ekrana ekle / Uygulamayı yükle.</p><p>Kitaplığının görünmesi için PDF’lerini uygulama içinde eklemen gerekebilir. Orijinal PDF’lerini sakla.</p><button class="primary">Anladım</button>';(document.fullscreenElement||document.body).append(dialog);dialog.querySelector('button').onclick=()=>{dialog.close();dialog.remove()};dialog.showModal();
}
function wordAtPoint(x,y){
 const caret=document.caretPositionFromPoint?.(x,y);const range=caret?null:document.caretRangeFromPoint?.(x,y);const node=caret?.offsetNode||range?.startContainer,offset=caret?.offset??range?.startOffset;
 if(!node||node.nodeType!==Node.TEXT_NODE||!node.parentElement.closest('.textLayer'))return null;
 const text=node.textContent;const matches=[...text.matchAll(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu)];const match=matches.find(m=>offset>=m.index&&offset<=m.index+m[0].length);if(!match)return null;
 const r=document.createRange();r.setStart(node,match.index);r.setEnd(node,match.index+match[0].length);const rect=r.getBoundingClientRect();if(x<rect.left-5||x>rect.right+5||y<rect.top-5||y>rect.bottom+5)return null;return {text:match[0],rect};
}
const dictionaryCache=new Map();let wordLookup=0;
async function showWord(word,rect){
 const lookup=++wordLookup;document.querySelector('.word-popup')?.remove();
 const popup=document.createElement('section');popup.className='word-popup';popup.setAttribute('role','dialog');popup.setAttribute('aria-label','Kelime açıklaması');popup.innerHTML='<button class="word-close" aria-label="Kapat">×</button><strong class="word-spelling"></strong><p class="word-meaning" role="status">Anlamı aranıyor…</p><form><input aria-label="Kelimeyi düzelt" maxlength="80"><button type="submit">Ara</button></form><small>Yalnızca aranan kelime Vikisözlük’e gönderilir.</small><a class="word-source" target="_blank" rel="noopener">Vikisözlük’te aç ↗</a>';
 (document.querySelector('.reader')||document.body).append(popup);popup.querySelector('.word-spelling').textContent=word;popup.querySelector('input').value=word;
 popup.querySelector('.word-close').onclick=()=>popup.remove();popup.querySelector('form').onsubmit=e=>{e.preventDefault();const corrected=popup.querySelector('input').value.trim();if(corrected)showWord(corrected,rect)};
 const link=popup.querySelector('.word-source');const title=word.toLocaleLowerCase('tr');link.href='https://tr.wiktionary.org/wiki/'+encodeURIComponent(title);
 const left=Math.max(8,Math.min(innerWidth-popup.offsetWidth-8,rect.left));const top=rect.top-popup.offsetHeight-10;
 popup.style.left=left+'px';popup.style.top=Math.max(8,Math.min(innerHeight-popup.offsetHeight-8,top>=8?top:rect.bottom+10))+'px';
 try{
  let definitions=dictionaryCache.get(title);
  if(!definitions){const endpoint=new URL('https://tr.wiktionary.org/w/api.php');endpoint.search=new URLSearchParams({action:'parse',page:title,prop:'text',format:'json',formatversion:'2',redirects:'1',origin:'*'});const response=await fetch(endpoint,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();const data=await response.json();if(data.error)definitions=[];else{const doc=new DOMParser().parseFromString(data.parse.text,'text/html');doc.querySelectorAll('script,style,sup,.mw-editsection,dl,ul').forEach(el=>el.remove());definitions=[...doc.querySelectorAll('.mw-parser-output > ol > li, .mw-parser-output > section > ol > li')].slice(0,3).map(el=>el.textContent.trim()).filter(Boolean);if(!definitions.length)definitions=[...doc.querySelectorAll('ol>li')].filter(el=>!el.parentElement.closest('li')).slice(0,3).map(el=>el.textContent.trim()).filter(Boolean);}dictionaryCache.set(title,definitions);}
  if(lookup!==wordLookup||!popup.isConnected)return;popup.querySelector('.word-meaning').textContent=definitions.length?definitions.join(' • '):'Bu yazılışla anlam bulunamadı. Kelimeyi kök hâliyle deneyebilir veya yazılışını düzeltebilirsin.';
 }catch{if(popup.isConnected)popup.querySelector('.word-meaning').textContent='Sözlüğe şu anda ulaşılamıyor. Bağlantıdan kelimeyi açabilirsin.';}
 popup.style.top=Math.max(8,Math.min(innerHeight-popup.offsetHeight-8,rect.top-popup.offsetHeight-10>=8?rect.top-popup.offsetHeight-10:rect.bottom+10))+'px';
}

