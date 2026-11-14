import { $, esc } from '../utils.js';
import { API_BASE_URL, ICONS } from '../config.js';
import { posts, statusBadge, purgeNote, normalizePost } from '../posts.js';
// สลับtab ของหาย/เจอของ
export let tab = 'lost';

export function postCard(p, index) {
  const isLost = p.type === 'lost';
  const n = p.images.length;
  const cover = n
    ? `<div class="gallery-wrap">
         <div class="gallery">${p.images.map((src) => `<img src="${esc(src)}" alt="">`).join('')}</div>
         ${n > 1 ? `<button type="button" class="g-btn prev" data-dir="-1" aria-label="รูปก่อนหน้า">‹</button>
                    <button type="button" class="g-btn next" data-dir="1" aria-label="รูปถัดไป">›</button>
                    <span class="g-count">1/${n}</span>` : ''}
       </div>`
    : `<svg viewBox="0 0 24 24">${ICONS[p.icon || 'bag']}</svg>`;

  return `
    <div class="card post" data-i="${index}">
      <div class="ph${n ? '' : ' noimg'}">${cover}</div>
      <div class="pb">
        ${statusBadge(p)}
        <div class="post-desc-bg">
          <p><b>${esc(p.desc)}</b></p>
        </div>
        <div class="meta">${isLost ? 'หายที่' : 'พบที่'}: ${esc(p.place)}</div>
        <div class="meta">เวลา: ${esc(p.time)}</div>
        ${purgeNote(p) ? `<div class="meta">${esc(purgeNote(p))}</div>` : ''}
        <button type="button" class="ct">ดูเพิ่มเติม</button>
      </div>
    </div>`;
}

export async function loadPosts() {
  try {
    const response = await fetch(`${API_BASE_URL}/posts`);
    if (!response.ok) throw new Error(`โหลดโพสต์ไม่สำเร็จ (${response.status})`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('รูปแบบข้อมูลโพสต์จาก backend ไม่ถูกต้อง');
    posts.splice(0, posts.length, ...data.map(normalizePost));
    render();
    return true;
  } catch (error) {
    const message = error.message || 'เกิดข้อผิดพลาดขณะโหลดโพสต์';
    $('feedL').innerHTML = `<p class="meta">${esc(message)}</p>`;
    $('feedF').innerHTML = `<p class="meta">${esc(message)}</p>`;
    $('nL').textContent = '—';
    $('nF').textContent = '—';
    return false;
  }
}

export function render() {
  const visible = posts.map((p, index) => ({ p, index })).filter((x) => x.p.status !== 'granted');
  [['lost', 'L'], ['found', 'F']].forEach(([kind, key]) => {
    const items = visible.filter((x) => x.p.type === kind);

    $('feed' + key).innerHTML =
      items.map((x) => postCard(x.p, x.index)).join('') ||
      '<p class="meta">ยังไม่มีรายการ</p>';
    $('n' + key).textContent = items.length;
  });

  document.querySelectorAll('.gallery').forEach((g) => {
    g.onscroll = () => {
      const i = Math.round(g.scrollLeft / g.clientWidth);
      const c = g.parentNode.querySelector('.g-count');
      if (c) c.textContent = `${i + 1}/${g.children.length}`;
    };
  });

  document.querySelectorAll('.g-btn').forEach((b) => {
    b.onclick = () => {
      const g = b.parentNode.querySelector('.gallery');
      g.scrollBy({ left: Number(b.dataset.dir) * g.clientWidth, behavior: 'smooth' });
    };
  });
}

export function setTab(t) {
  tab = t;
  $('home').dataset.tab = t;
  $('tL').className = t === 'lost' ? 'on l' : ''; $('tF').className = t === 'found' ? 'on' : '';
}

$('tL').onclick = () => setTab('lost'); $('tF').onclick = () => setTab('found');
