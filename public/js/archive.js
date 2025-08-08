// AOTU Archive — fetch from WP REST
const grid = document.getElementById('grid');
const state = document.getElementById('state');
const typeFilter = document.getElementById('type');
const searchInput = document.getElementById('q');
const refreshBtn = document.getElementById('refresh');
const lb = document.getElementById('lb');
const lbMedia = document.getElementById('lbMedia');
const lbTitle = document.getElementById('lbTitle');
const lbInfo = document.getElementById('lbInfo');
const lbTags = document.getElementById('lbTags');
const lbNotes = document.getElementById('lbNotes');

const WP_API_URL = 'https://thearchiveoftheuntamed.xyz/wp-json/wp/v2/media';
let CACHE = [];

async function fetchArchive() {
  state.hidden = false; state.textContent = 'Loading…'; grid.hidden = true;
  try {
    const url = new URL(WP_API_URL);
    url.searchParams.set('per_page','50');
    url.searchParams.set('_fields','id,date,mime_type,media_type,source_url,title,alt_text,caption,media_details');
    const q = searchInput.value.trim(); if (q) url.searchParams.set('search', q);
    const res = await fetch(url, { mode: 'cors' }); if(!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json(); CACHE = Array.isArray(data)?data:[]; renderArchive();
  } catch(err) { console.error(err); state.textContent = 'Error loading archive (check CORS & API).'; }
}

function mapType(item){ const mt=(item.mime_type||'').toLowerCase(); if(mt.startsWith('image/')) return 'image'; if(mt.startsWith('video/')) return 'video'; if(mt.startsWith('audio/')) return 'audio'; return 'doc'; }
function thumb(item){ const s=item.media_details&&item.media_details.sizes; if(s){ if(s.medium?.source_url) return s.medium.source_url; if(s.thumbnail?.source_url) return s.thumbnail.source_url; if(s.full?.source_url) return s.full.source_url; } return item.source_url; }
function escapeHtml(s){ return s?String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m])):''; }

function renderArchive(){
  const wanted = typeFilter.value.trim();
  const list = CACHE.filter(it => !wanted || mapType(it)===wanted);
  grid.innerHTML='';
  if(!list.length){ state.hidden=false; state.textContent='No results'; grid.hidden=true; return; }
  state.hidden=true; grid.hidden=false;
  list.forEach(item=>{
    const t = mapType(item);
    const el = document.createElement('article'); el.className='card';
    const imgHTML = t==='image' ? `<img loading="lazy" src="${thumb(item)}" alt="${escapeHtml(item.title?.rendered||'')}">` : `<div class="ph">${t.toUpperCase()}</div>`;
    el.innerHTML = `<a href="#" data-id="${item.id}">${imgHTML}<div class="meta"><h3 class="title">${escapeHtml(item.title?.rendered||'Untitled')}</h3><div class="muted">${(item.date||'').slice(0,10)}</div></div></a>`;
    el.querySelector('a').addEventListener('click', e=>{e.preventDefault(); openLightbox(item);});
    grid.appendChild(el);
  });
}

function openLightbox(item){
  const t = mapType(item);
  lbTitle.textContent = item.title?.rendered || 'Untitled';
  lbInfo.textContent = [t,(item.date||'').slice(0,10)].filter(Boolean).join(' · ');
  lbTags.textContent = item.alt_text || '';
  lbNotes.innerHTML = item.caption?.rendered || '';
  lbMedia.innerHTML='';
  if(t==='image'){ const img=new Image(); img.src=item.source_url; img.alt=item.title?.rendered||''; lbMedia.appendChild(img); }
  else if(t==='video'){ const v=document.createElement('video'); v.src=item.source_url; v.controls=true; lbMedia.appendChild(v); }
  else if(t==='audio'){ const a=document.createElement('audio'); a.src=item.source_url; a.controls=true; lbMedia.appendChild(a); }
  else { const p=document.createElement('p'); p.innerHTML=`Document: <a href="${item.source_url}" target="_blank" rel="noopener">open</a>`; lbMedia.appendChild(p); }
  lb.showModal();
}

refreshBtn.addEventListener('click', fetchArchive);
typeFilter.addEventListener('change', renderArchive);
searchInput.addEventListener('keypress', e=>{ if(e.key==='Enter') fetchArchive(); });
fetchArchive();