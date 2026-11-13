import { esc } from '../utils.js';
import { dm } from './detail.js';

export let lb = null;
let lbSource = null;

function lbKey(e) {
  if (e.key === 'Escape') closeLightbox();
  else if (e.key === 'ArrowLeft') lbGo(-1);
  else if (e.key === 'ArrowRight') lbGo(1);
}

function lbGo(dir) {
  if (!lb) return;
  const t = lb.querySelector('.lb-track');
  t.scrollBy({ left: dir * t.clientWidth, behavior: 'smooth' });
}

export function closeLightbox() {
  if (!lb) return;
  const t = lb.querySelector('.lb-track');
  const i = Math.round(t.scrollLeft / t.clientWidth);
  if (lbSource && lbSource.isConnected) {
    lbSource.style.scrollBehavior = 'auto';
    lbSource.scrollLeft = i * lbSource.clientWidth;
    lbSource.style.scrollBehavior = '';
  }
  lb.remove();
  lb = null;
  lbSource = null;
  document.body.style.overflow = dm ? 'hidden' : '';
  document.removeEventListener('keydown', lbKey);
}

export function openLightbox(srcs, start, source) {
  closeLightbox();
  lbSource = source;
  const n = srcs.length;
  lb = document.createElement('div');
  lb.className = 'lb';
  lb.innerHTML = `
    <div class="lb-track">${srcs.map((s) => `<div class="lb-slide"><img src="${esc(s)}" alt=""></div>`).join('')}</div>
    <button type="button" class="lb-x" aria-label="ปิด">✕</button>
    ${n > 1 ? `<button type="button" class="lb-nav prev" aria-label="รูปก่อนหน้า">‹</button>
               <button type="button" class="lb-nav next" aria-label="รูปถัดไป">›</button>
               <span class="lb-count">${start + 1}/${n}</span>` : ''}`;
  document.body.appendChild(lb);
  document.body.style.overflow = 'hidden';

  const t = lb.querySelector('.lb-track');
  t.style.scrollBehavior = 'auto';
  t.scrollLeft = start * t.clientWidth;
  t.style.scrollBehavior = '';
  t.onscroll = () => {
    const c = lb && lb.querySelector('.lb-count');
    if (c) c.textContent = `${Math.round(t.scrollLeft / t.clientWidth) + 1}/${n}`;
  };

  lb.querySelector('.lb-x').onclick = closeLightbox;
  const pv = lb.querySelector('.lb-nav.prev');
  const nx = lb.querySelector('.lb-nav.next');
  if (pv) pv.onclick = () => lbGo(-1);
  if (nx) nx.onclick = () => lbGo(1);
  lb.querySelectorAll('.lb-slide').forEach((slide) => {
    slide.onclick = (e) => { if (e.target === slide) closeLightbox(); };
  });
  document.addEventListener('keydown', lbKey);
}
