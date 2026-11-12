const $ = (id) => document.getElementById(id);

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  }[c]));

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function notify(text) {
  const el = document.createElement('div');
  el.className = 'flash';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

const fullImageUrl = (u) => (/^(https?:|data:)/.test(u) ? u : API_ORIGIN + u);

async function errorText(response, fallback, overrides = {}) {
  let detail = '';
  try {
    const raw = await response.text();
    try {
      const j = JSON.parse(raw);
      detail = j.message || j.error || j.detail || '';
    } catch { detail = raw; }
  } catch { }
  detail = String(detail || '').trim();
  if (detail.startsWith('<')) detail = '';
  const byStatus = {
    400: 'ข้อมูลไม่ถูกต้อง',
    401: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
    403: 'คุณไม่มีสิทธิ์ทำรายการนี้',
    404: 'ไม่พบข้อมูล (อาจถูกลบไปแล้ว)',
    409: 'ทำรายการไม่ได้ เพราะสถานะเปลี่ยนไปแล้ว กรุณารีเฟรชหน้า',
  };
  if (response.status === 400 && detail) return detail;
  return overrides[response.status] || byStatus[response.status] || detail || fallback;
}

const EMPLOYEE_ID_PATTERN = /^\d+$/;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 5;
const API_ORIGIN = 'http://localhost:8080';
const API_BASE_URL = `${API_ORIGIN}/api`;
const SESSION_EMAIL_KEY = 'lostAndFoundEmail';
const SESSION_TOKEN_KEY = 'lostAndFoundToken';
const SESSION_DISPLAY_NAME_KEY = 'lostAndFoundDisplayName';

const ICONS = {
  wallet: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M16 12h5v3h-5a1.5 1.5 0 0 1 0-3z"/>',
  key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v4"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
};

const extraStyle = document.createElement('style');
extraStyle.textContent = `
  .ph { grid-template-columns: minmax(0, 1fr); }
  .gallery-wrap { position:relative; width:100%; height:100%; min-width:0; }
  .gallery { display:flex; gap:0; overflow-x:auto; width:100%; height:100%; min-width:0;
             scroll-snap-type:x mandatory; scrollbar-width:none; -webkit-overflow-scrolling:touch; }
  .gallery::-webkit-scrollbar { display:none; }
  .gallery img { flex:0 0 100%; width:100%; height:100%; object-fit:cover; scroll-snap-align:start; }
  .g-btn { position:absolute; top:50%; transform:translateY(-50%); width:32px; height:32px;
           border:0; border-radius:50%; background:rgba(0,0,0,.55); color:#fff; font-size:1.3rem;
           line-height:1; cursor:pointer; z-index:2; }
  .g-btn.prev { left:8px; } .g-btn.next { right:8px; }
  .g-count { position:absolute; bottom:8px; right:8px; background:rgba(0,0,0,.6); color:#fff;
             font-size:.75rem; padding:2px 8px; border-radius:20px; z-index:2; }
  .gallery img { cursor:zoom-in; }
  .lb { position:fixed; inset:0; z-index:1000; background:rgba(0,0,0,.93); }
  .lb-track { display:flex; width:100%; height:100%; overflow-x:auto; scroll-snap-type:x mandatory;
              scrollbar-width:none; -webkit-overflow-scrolling:touch; }
  .lb-track::-webkit-scrollbar { display:none; }
  .lb-slide { flex:0 0 100%; height:100%; scroll-snap-align:center; display:flex; align-items:center;
              justify-content:center; padding:56px 12px; }
  .lb-slide img { max-width:100%; max-height:100%; object-fit:contain; border-radius:6px; }
  .lb-x, .lb-nav { position:absolute; border:0; border-radius:50%; background:rgba(255,255,255,.18);
                   color:#fff; cursor:pointer; line-height:1; }
  .lb-x { top:calc(12px + env(safe-area-inset-top, 0px)); right:12px; width:40px; height:40px; font-size:1.2rem; }
  .lb-nav { top:50%; transform:translateY(-50%); width:44px; height:44px; font-size:1.8rem; }
  .lb-nav.prev { left:12px; } .lb-nav.next { right:12px; }
  .lb-x:hover, .lb-nav:hover { background:rgba(255,255,255,.32); }
  .lb-count { position:absolute; top:calc(20px + env(safe-area-inset-top, 0px)); left:50%; transform:translateX(-50%);
              color:#fff; font-size:.95rem; background:rgba(0,0,0,.45); padding:2px 12px; border-radius:20px; }
  #thumbs { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:8px; }
  #thumbs:empty { display:none; }
  #thumbs .th { width:88px; }
  #thumbs .th img { width:88px; height:88px; object-fit:cover; border-radius:8px; display:block; }
  #thumbs .th .row { display:flex; justify-content:space-between; margin-top:4px; }
  #thumbs .th button { cursor:pointer; }

  .ph { height:auto; }
  .ph.noimg { height:200px; }
  .gallery-wrap { height:auto; }
  .ph .gallery { height:auto; align-items:center; }
  .ph .gallery img { height:auto; max-height:480px; object-fit:contain; cursor:pointer; }
  .post { cursor:pointer; }
  .post .post-desc-bg p { display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
  .more { display:block; margin:0 0 8px; padding:0; border:0; background:none; cursor:pointer;
          font:inherit; font-size:.88rem; font-weight:600; color:var(--pri-ink); }
  .more:hover { text-decoration:underline; }

  .dm { position:fixed; inset:0; z-index:900; background:rgba(0,0,0,.55); display:flex;
        align-items:flex-end; justify-content:center; }
  .dm-sheet { background:var(--card); width:100%; max-width:560px; max-height:92vh; overflow-y:auto;
              border-radius:18px 18px 0 0; padding:16px 16px calc(16px + env(safe-area-inset-bottom, 0px)); }
  @media (min-width:600px) { .dm { align-items:center; padding:24px; } .dm-sheet { border-radius:18px; } }
  .dm-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
  .dm-tag { font-weight:700; font-size:.85rem; padding:3px 12px; border-radius:20px; }
  .dm-tag.l { background:var(--lsoft); color:var(--lost-ink); }
  .dm-tag.f { background:var(--fsoft); color:var(--found-ink); }
  .dm-x { width:36px; height:36px; border:1px solid var(--bd); border-radius:50%; background:var(--field);
          color:var(--tx); cursor:pointer; font-size:1rem; }
  .dm-gwrap { position:relative; margin-bottom:12px; border-radius:12px; overflow:hidden; background:var(--field); }
  .dm-gallery { display:flex; overflow-x:auto; scroll-snap-type:x mandatory; scrollbar-width:none;
                -webkit-overflow-scrolling:touch; align-items:center; }
  .dm-gallery::-webkit-scrollbar { display:none; }
  .dm-gallery img { flex:0 0 100%; width:100%; height:auto; max-height:65vh; object-fit:contain;
                    scroll-snap-align:start; cursor:zoom-in; display:block; }
  .dm .post-desc-bg p { white-space:pre-wrap; }
  .dm .ctv { margin-top:0; }
  .dm-head { position:relative; }
  .dm-tools { display:flex; gap:8px; }
  .dm-x svg { width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:1.8;
              stroke-linecap:round; stroke-linejoin:round; vertical-align:middle; }
  .dm-menu { position:absolute; right:0; top:44px; z-index:3; min-width:200px; background:var(--card);
             border:1px solid var(--bd); border-radius:12px; padding:4px; box-shadow:0 8px 24px rgba(0,0,0,.18); }
  .dm-menu button { display:block; width:100%; text-align:left; border:0; background:none; font:inherit;
                    color:var(--tx); padding:10px 12px; border-radius:8px; cursor:pointer; }
  .dm-menu button:hover { background:var(--field); }
  .dm-contact, .dm-bar { position:sticky; bottom:calc(-16px - env(safe-area-inset-bottom, 0px)); background:var(--card);
                margin:16px -16px calc(-16px - env(safe-area-inset-bottom, 0px)); padding:12px 16px calc(16px + env(safe-area-inset-bottom, 0px));
                border-top:1px solid var(--bd); }
  .dm-contact .ct { margin-top:0; background:var(--pri); border-color:var(--pri); color:var(--pt); padding:12px 14px; font-size:1rem; }
  .dm-contact .ct:hover { background:var(--pri); color:var(--pt); opacity:.9; }
  .dm-contact .dm-form label { margin-top:0; }
  .dm-contact .dm-form .btn { margin-top:8px; padding:11px; }
  .dm-menu button.danger { color:var(--err); }
  .cf { position:absolute; inset:0; z-index:5; background:rgba(0,0,0,.5); display:flex;
        align-items:center; justify-content:center; padding:24px; }
  .cf-box { background:var(--card); border-radius:16px; padding:20px; width:100%; max-width:340px; text-align:center; }
  .cf-box p { margin:0 0 8px; font-weight:600; }
  .cf-act { display:flex; gap:10px; }
  .cf-act button { flex:1; padding:11px; border-radius:10px; font:inherit; font-weight:600; cursor:pointer;
                   border:1px solid var(--bd); background:var(--field); color:var(--tx); }
  .cf-act .btn { border:0; background:var(--pri); color:var(--pt); }
  .cf-act button.danger { background:var(--err); border-color:var(--err); color:#fff; }
  .cf-act button:disabled { opacity:.6; cursor:default; }

  .dm-info { display:flex; flex-direction:column; min-width:0; }
  .dm-edit { max-width:560px; margin:0 auto; }
  .dm-contact.open { position:static; }
  .flash { position:fixed; top:calc(16px + env(safe-area-inset-top, 0px)); left:50%; transform:translateX(-50%); z-index:1200;
           background:var(--ok); color:var(--ok-tx); padding:10px 20px; border-radius:12px; font-weight:600;
           box-shadow:0 8px 24px rgba(0,0,0,.2); }
  .st { display:inline-block; font-size:.78rem; font-weight:700; padding:2px 10px; border-radius:20px; margin-bottom:8px; }
  .st.pending { background:#fdebc8; color:#8a5a00; }
  .st.granted { background:#dcefd2; color:#2f6b1f; }
  .dm-left { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .dm-status .st { margin-bottom:0; }
  .dm-owner-act .btn:disabled { opacity:.45; cursor:default; }
  .dm-owner-hint { color:var(--mut); font-size:.88rem; }
  .dm-owner-msg { color:var(--err); font-weight:700; margin:0 0 8px; }
  .dm-claims { margin-top:14px; }
  .claims-title { font-weight:700; margin-bottom:8px; }
  .claim { border:1px solid var(--bd); background:var(--field); border-radius:12px; padding:10px 12px; margin-bottom:10px; }
  .claim.rejected { opacity:.6; }
  .claim-imgs { display:flex; gap:8px; margin:8px 0; }
  .claim-imgs img { width:88px; height:88px; object-fit:cover; border-radius:10px; border:1px solid var(--bd); cursor:zoom-in; }
  .dm-owner-act { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .dm-reject { padding:10px 20px; border:1px solid var(--err); border-radius:12px; background:none; color:var(--err);
               font:inherit; font-weight:600; font-size:1rem; cursor:pointer; }
  .dm-reject:hover { background:var(--err); color:#fff; }
  .dm-reject:disabled { opacity:.45; cursor:default; }
  .dm-owner-act .btn { width:auto; padding:10px 28px; }
  .dm-check { color:#2f8a2f; font-size:1.6rem; font-weight:700; line-height:1; }
  .dm-pics { display:flex; flex-direction:column; gap:10px; margin-top:8px; }
  .dm-pic { position:relative; width:100%; border-radius:10px; overflow:hidden; border:1px solid var(--bd); background:var(--field); }
  .dm-pic img { display:block; width:100%; height:auto; }
  .dm-pic.bad { border-color:var(--err); padding:10px 40px 10px 12px; }
  .bad-info { display:flex; flex-direction:column; font-size:.85rem; color:var(--err); word-break:break-all; }
  .dm-pic button { position:absolute; top:6px; right:6px; width:26px; height:26px; border:0; border-radius:50%;
                   background:rgba(0,0,0,.65); color:#fff; cursor:pointer; font-size:.75rem; line-height:1; }
  .dm-addpic { margin-top:6px; padding:8px 14px; border:1px dashed var(--bd); border-radius:10px; background:var(--field);
               color:var(--tx); font:inherit; font-size:.9rem; cursor:pointer; }
  @media (min-width:600px) {
    .dm-sheet { max-width:920px; }
    .dm-view { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:20px; align-items:start; }
    .dm-view.noimg { grid-template-columns:minmax(0,1fr); }
    .dm-gwrap { margin-bottom:0; }
    .dm-contact, .dm-bar { position:static; margin:16px 0 0; padding:12px 0 0; }
  }
`;
document.head.appendChild(extraStyle);

$('file').multiple = true;

let photoFiles = [];
let type = 'lost';
let tab = 'lost';

const posts = [];

function statusBadge(p) {
  if (p.status === 'pending') return '<span class="st pending">รอยืนยัน (Pending)</span>';
  if (p.status === 'granted') return '<span class="st granted">ส่งมอบแล้ว (Granted)</span>';
  return '';
}

function isOwner(p) {
  const me = (localStorage.getItem(SESSION_EMAIL_KEY) || '').toLowerCase();
  return !!me && String(p.authorEmail).toLowerCase() === me;
}

function postCard(p, index) {
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

const DELETE_AFTER_DAYS = 30;

function purgeNote(p) {
  if (p.status !== 'granted') return '';
  if (!p.grantedAt) return `โพสต์ปิดแล้ว รอลบภายใน ${DELETE_AFTER_DAYS} วัน`;
  const left = Math.ceil((new Date(p.grantedAt).getTime() + DELETE_AFTER_DAYS * 86400000 - Date.now()) / 86400000);
  return left > 0 ? `โพสต์ปิดแล้ว จะถูกลบอัตโนมัติใน ${left} วัน` : 'โพสต์ปิดแล้ว รอการลบอัตโนมัติ';
}

function mapPostStatus(v) {
  const x = String(v || '').toLowerCase();
  if (x === 'claimed' || x === 'pending') return 'pending';
  if (x === 'returned' || x === 'granted') return 'granted';
  return 'open';
}

function normalizePost(post) {
  const isFound = String(post.type).toLowerCase() === 'found';
  return {
    id: post.id,
    authorEmail: post.authorEmail || '',
    grantedAt: post.grantedAt || null,
    status: mapPostStatus(post.status),
    type: isFound ? 'found' : 'lost',
    images: (post.images || post.imageUrls || [])
      .map((im) => fullImageUrl(typeof im === 'string' ? im : im.imageUrl)),
    imageIds: (post.images || []).map((im) => (typeof im === 'string' ? null : (im.id ?? null))),
    icon: isFound ? 'wallet' : 'bag',
    desc: post.desc || post.description || post.title || '',
    place: post.place || post.location || '',
    name: post.name || post.contactName || post.authorEmail || '',
    contact: post.contact || post.contactInfo || '',
    time: post.createdAt
      ? new Date(post.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
      : '',
  };
}

async function loadPosts() {
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

function render() {
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

function show(view) {
  $('login').hidden = view !== 'login'; $('home').hidden = view !== 'home';
  $('form').hidden = view !== 'form'; $('app-nav').hidden = view === 'login';

  if ($('navHome') && $('navAdd')) {
    $('navHome').classList.toggle('active', view === 'home'); $('navAdd').classList.toggle('active', view === 'form');
  }

  document.body.classList.toggle('plaid', view !== 'login');
  window.scrollTo(0, 0);
}

function setTab(t) {
  tab = t;
  $('home').dataset.tab = t;
  $('tL').className = t === 'lost' ? 'on l' : ''; $('tF').className = t === 'found' ? 'on' : '';
}

function setType(t) {
  type = t;
  const isLost = t === 'lost';
  $('sL').className = isLost ? 'on l' : '';
  $('sF').className = isLost ? '' : 'on';
  $('post').className = 'btn ' + (isLost ? 'l' : 'f');
  $('locL').textContent = isLost ? 'สถานที่ที่ทำหาย' : 'สถานที่ที่พบ';
  $('opt').textContent = isLost ? '(ไม่บังคับ)' : '';
  $('fsub').textContent = isLost
    ? 'แจ้งของที่คุณทำหาย เพื่อให้คนที่เจอติดต่อกลับได้'
    : 'กรอกข้อมูลของที่คุณเจอ เพื่อให้เจ้าของติดต่อกลับได้';
}

function renderPreviews() {
  let box = $('thumbs');
  if (!box) {
    box = document.createElement('div');
    box.id = 'thumbs';
    $('drop').parentNode.insertBefore(box, $('drop'));
    box.onclick = (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const i = Number(btn.dataset.i);
      const act = btn.dataset.act;
      if (act === 'del') {
        URL.revokeObjectURL(photoFiles[i].url);
        photoFiles.splice(i, 1);
      } else {
        const j = act === 'left' ? i - 1 : i + 1;
        if (j < 0 || j >= photoFiles.length) return;
        [photoFiles[i], photoFiles[j]] = [photoFiles[j], photoFiles[i]];
      }
      renderPreviews();
    };
  }

  box.innerHTML = photoFiles.map((p, i) => `
    <div class="th">
      <img src="${esc(p.url)}" alt="">
      <div class="row">
        <button type="button" data-act="left" data-i="${i}" ${i === 0 ? 'disabled' : ''}>◀</button>
        <button type="button" data-act="del" data-i="${i}">✕</button>
        <button type="button" data-act="right" data-i="${i}" ${i === photoFiles.length - 1 ? 'disabled' : ''}>▶</button>
      </div>
    </div>`).join('');

  $('prev').hidden = true;
  $('drop').hidden = photoFiles.length >= MAX_IMAGES;
}

function resetForm() {
  photoFiles.forEach((p) => URL.revokeObjectURL(p.url));
  photoFiles = [];
  ['desc', 'loc', 'name', 'tel', 'file'].forEach((id) => ($(id).value = ''));
  ['eImg', 'eDesc', 'eLoc', 'eName', 'eTel'].forEach((id) => ($(id).textContent = ''));
  renderPreviews();
}

function handleImage(e) {
  const files = Array.from(e.target.files || []);
  $('file').value = '';
  if (!files.length) return;

  let message = '';
  for (const file of files) {
    if (photoFiles.length >= MAX_IMAGES) { message = `แนบได้สูงสุด ${MAX_IMAGES} รูป`; break; }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { message = 'กรุณาส่งไฟล์ชนิด PNG, JPEG หรือ WEBP เท่านั้น'; continue; }
    if (file.size > MAX_IMAGE_BYTES) { message = 'ไฟล์ใหญ่เกิน 5 MB'; continue; }
    photoFiles.push({ file, url: URL.createObjectURL(file) });
  }
  $('eImg').textContent = message;
  renderPreviews();
}

async function submitPost() {
  const v = {
    title: $('desc').value.trim(),
    description: $('desc').value.trim(),
    location: $('loc').value.trim(),
    name: $('name').value.trim(),
    contact: $('tel').value.trim(),
    type,
  };
  const errors = {
    eImg: photoFiles.length || type === 'lost' ? '' : 'กรุณาเพิ่มรูปภาพ',
    eDesc: v.title ? '' : 'กรุณาใส่รายละเอียด',
    eLoc: v.location ? '' : 'กรุณาใส่สถานที่',
    eName: v.name ? '' : 'กรุณาใส่ชื่อ',
    eTel: v.contact ? '' : 'กรุณาใส่ช่องทางติดต่อ',
  };
  Object.keys(errors).forEach((id) => ($(id).textContent = errors[id]));

  if (Object.values(errors).some(Boolean)) {
    const firstError = document.querySelector('.err:not(:empty)');
    if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  try {
    const token = localStorage.getItem(SESSION_TOKEN_KEY);

    const postData = {
      type: v.type,
      title: v.title.slice(0, 100),
      description: v.description,
      location: v.location,
      contactName: v.name,
      contactInfo: v.contact,
      authorEmail: localStorage.getItem(SESSION_EMAIL_KEY) || 'anonymous@tu.ac.th',
    };

    const formData = new FormData();
    formData.append('post', new Blob([JSON.stringify(postData)], { type: 'application/json' }));
    photoFiles.forEach(({ file }) => formData.append('images', file));

    const response = await fetch(`${API_BASE_URL}/posts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) {
      alert(await errorText(response, 'เกิดข้อผิดพลาดในการบันทึกข้อมูล'));
      return;
    }

    const savedPost = await response.json();
    resetForm();
    const refreshed = await loadPosts();
    if (!refreshed) {
      posts.unshift(normalizePost(savedPost));
      render();
    }
    setTab(type);
    $('toast').hidden = false;
    show('home');
  }
  catch (error) {
    console.error('Network Error:', error);
    alert('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
  }
}

function showLoginMessage(text) {
  $('lgmsg').textContent = text;
  $('lgmsg').hidden = false;
}

async function login() {
  const employeeId = $('employeeId').value.trim();
  const password = $('pw').value;
  $('employeeId').value = employeeId;

  let employeeIdError = '';
  if (!employeeId) employeeIdError = 'กรุณากรอกรหัสประจำตัวบุคลากร';
  else if (!EMPLOYEE_ID_PATTERN.test(employeeId)) employeeIdError = 'รหัสประจำตัวบุคลากรต้องเป็นตัวเลขเท่านั้น';

  const hasInvalidChar = /[^a-zA-Z0-9]/.test(password);
  let passwordError = '';
  if (!password) passwordError = 'กรุณากรอกรหัสผ่าน';
  else if (hasInvalidChar) passwordError = 'รหัสผ่านต้องเป็นภาษาอังกฤษและตัวเลขเท่านั้น';

  $('eEmployeeId').textContent = employeeIdError;
  $('ePw').textContent = passwordError;
  if (employeeIdError || passwordError) return;

  $('lgmsg').hidden = true;
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, password }),
    });
    const text = await response.text();
    let data = {};
    try { data = JSON.parse(text); } catch { data = { message: text }; }
    if (!response.ok || !data.token) throw new Error(data.message || 'รหัสประจำตัวหรือรหัสผ่านไม่ถูกต้อง');

    const accountEmail = data.email || data.employeeId;
    const displayName = data.displayName || accountEmail;
    $('who').textContent = displayName;
    $('pw').value = '';
    localStorage.setItem(SESSION_EMAIL_KEY, accountEmail);
    localStorage.setItem(SESSION_DISPLAY_NAME_KEY, displayName);
    localStorage.setItem(SESSION_TOKEN_KEY, data.token);
    await loadPosts();
    show('home');
  } catch (error) {
    showLoginMessage(error.message || 'ไม่สามารถเชื่อมต่อระบบได้');
  }
}

$('loginBtn').onclick = login;
['employeeId', 'pw'].forEach((id) => {
  $(id).onkeydown = (e) => { if (e.key === 'Enter') login(); };
});
$('employeeId').onblur = () => ($('employeeId').value = $('employeeId').value.trim());

$('pw').oninput = (e) => {
  const hasInvalidChar = /[^a-zA-Z0-9]/.test(e.target.value);
  $('ePw').textContent = hasInvalidChar ? 'กรุณาใช้ภาษาอังกฤษและตัวเลขเท่านั้น' : '';
};

$('eye').onclick = () => {
  const pw = $('pw');
  const isPassword = pw.type === 'password';
  pw.type = isPassword ? 'text' : 'password';

  $('eye').innerHTML = isPassword
    ? '<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
};

$('forgot').onclick = (e) => {
  e.preventDefault();
  showLoginMessage('ฟีเจอร์นี้ต้องเชื่อมระบบของมหาวิทยาลัยจริง (เวอร์ชันตัวอย่างยังไม่รองรับ)');
};

$('logout').onclick = () => {
  localStorage.removeItem(SESSION_EMAIL_KEY);
  localStorage.removeItem(SESSION_TOKEN_KEY);
  localStorage.removeItem(SESSION_DISPLAY_NAME_KEY);
  $('employeeId').value = '';
  $('who').textContent = '';
  show('login');
};

$('navHome').onclick = () => show('home');

$('tL').onclick = () => setTab('lost'); $('tF').onclick = () => setTab('found');
$('navAdd').onclick = () => { $('toast').hidden = true; setType(tab); show('form'); };

$('sL').onclick = () => setType('lost');
$('sF').onclick = () => setType('found'); $('back').onclick = () => { resetForm(); show('home'); };
$('drop').onclick = () => $('file').click();
$('drop').onkeydown = (e) => { if (e.key === 'Enter') $('file').click(); };
$('file').onchange = handleImage;
$('post').onclick = submitPost;

let lb = null;
let lbSource = null;
let dm = null;

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

function closeLightbox() {
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

function openLightbox(srcs, start, source) {
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

function dmKey(e) {
  if (e.key === 'Escape' && !lb) closeDetail();
}

function closeDetail() {
  if (!dm) return;
  (dm._pics || []).forEach((x) => URL.revokeObjectURL(x.url));
  (dm._editPics || []).forEach((x) => URL.revokeObjectURL(x.url));
  dm.remove();
  dm = null;
  if (!lb) document.body.style.overflow = '';
  document.removeEventListener('keydown', dmKey);
}

function openDetail(index) {
  const p = posts[index];
  if (!p) return;
  closeDetail();
  const isLost = p.type === 'lost';
  const n = p.images.length;

  dm = document.createElement('div');
  dm.className = 'dm';
  dm.innerHTML = `
    <div class="dm-sheet" role="dialog" aria-modal="true">
      <div class="dm-head">
        <div class="dm-left">
          <span class="dm-tag ${isLost ? 'l' : 'f'}">${isLost ? 'ของหาย' : 'เจอของ'}</span>
          <span class="dm-status">${statusBadge(p)}</span>
        </div>
        <div class="dm-tools">
          ${isOwner(p) ? `
          <button type="button" class="dm-x dm-gear" aria-label="ตั้งค่า" aria-haspopup="true">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
          ` : ''}
          <button type="button" class="dm-x dm-close" aria-label="ปิด">✕</button>
        </div>
        ${isOwner(p) ? `
        <div class="dm-menu" hidden>
          <button type="button" data-act="edit">แก้ไขโพสต์</button>
          <button type="button" data-act="del" class="danger">ลบโพสต์</button>
        </div>
        ` : ''}
      </div>
      <div class="dm-view${n ? '' : ' noimg'}">
      ${n ? `<div class="dm-gwrap">
               <div class="dm-gallery">${p.images.map((src) => `<img src="${esc(src)}" alt="">`).join('')}</div>
               ${n > 1 ? `<button type="button" class="g-btn prev" data-dir="-1" aria-label="รูปก่อนหน้า">‹</button>
                          <button type="button" class="g-btn next" data-dir="1" aria-label="รูปถัดไป">›</button>
                          <span class="g-count">1/${n}</span>` : ''}
             </div>` : ''}
      <div class="dm-info">
      <div class="post-desc-bg"><p><b>${esc(p.desc)}</b></p></div>
      <div class="meta">${isLost ? 'หายที่' : 'พบที่'}: ${esc(p.place)}</div>
      <div class="meta">เวลา: ${esc(p.time)}</div>
      ${purgeNote(p) ? `<div class="meta">${esc(purgeNote(p))}</div>` : ''}
      <div class="dm-contact"${p.status === 'granted' || isOwner(p) ? ' hidden' : ''}>
        <button type="button" class="ct dm-ctbtn">ติดต่อเจ้าของโพสต์</button>
        <div class="dm-form" hidden>
          <label for="dmName">ชื่อ</label>
          <input id="dmName" placeholder="ชื่อ-นามสกุล หรือชื่อเล่น">
          <label for="dmInfo">เบอร์โทร / LINE ID / อีเมล</label>
          <input id="dmInfo" placeholder="เช่น 08x-xxx-xxxx หรือ lineid">
          <div class="err dm-err"></div>
          <label>แนบรูปภาพยืนยัน (PNG, JPEG, WEBP ไม่เกิน 2 รูป)</label>
          <button type="button" class="dm-addpic">＋ เพิ่มรูป</button>
          <input type="file" class="dm-picfile" accept="image/png,image/jpeg,image/webp" multiple hidden>
          <div class="dm-pics"></div>
          <div class="err dm-pic-err"></div>
          <button type="button" class="btn dm-confirm">ยืนยัน</button>
        </div>
        <div class="ctv" hidden>ส่งคำขอแล้ว รอเจ้าของโพสต์ตรวจสอบ</div>
      </div>
      ${isOwner(p) ? '<div class="dm-claims"><div class="meta">กำลังโหลดคำขอ...</div></div>' : ''}
      </div>
      </div>
      <div class="dm-edit" hidden>
        <label for="edDesc">รายละเอียดของสิ่งของ</label>
        <textarea id="edDesc">${esc(p.desc)}</textarea>
        <label for="edPlace">${isLost ? 'สถานที่ที่ทำหาย' : 'สถานที่ที่พบ'}</label>
        <input id="edPlace" value="${esc(p.place)}">
        <label for="edName">ชื่อ</label>
        <input id="edName" value="${esc(p.name)}">
        <label for="edContact">เบอร์โทร / LINE ID / อีเมล</label>
        <input id="edContact" value="${esc(p.contact)}">
        <label>รูปภาพ (PNG, JPEG, WEBP ไม่เกิน ${MAX_IMAGES} รูป)</label>
        <div class="dm-pics ed-imgs"></div>
        <button type="button" class="dm-addpic ed-add">＋ เพิ่มรูป</button>
        <input type="file" class="ed-file" accept="image/png,image/jpeg,image/webp" multiple hidden>
        <div class="dm-pics ed-new"></div>
        <div class="err ed-imgerr"></div>
        <div class="err dm-eerr"></div>
        <div class="cf-act" style="margin-top:12px">
          <button type="button" class="dm-ecancel">ยกเลิก</button>
          <button type="button" class="btn dm-esave">บันทึก</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(dm);
  document.body.style.overflow = 'hidden';

  const g = dm.querySelector('.dm-gallery');
  if (g) {
    g.onscroll = () => {
      const c = dm.querySelector('.g-count');
      if (c) c.textContent = `${Math.round(g.scrollLeft / g.clientWidth) + 1}/${n}`;
    };
    dm.querySelectorAll('.g-btn').forEach((b) => {
      b.onclick = () => g.scrollBy({ left: Number(b.dataset.dir) * g.clientWidth, behavior: 'smooth' });
    });
  }

  dm.querySelector('.dm-close').onclick = closeDetail;
  dm.onclick = (e) => {
    if (e.target === dm) { closeDetail(); return; }
    const m = dm.querySelector('.dm-menu');
    if (m && !e.target.closest('.dm-gear, .dm-menu')) m.hidden = true;
  };

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem(SESSION_TOKEN_KEY)}` });

  const menu = dm.querySelector('.dm-menu');
  if (menu) {
    dm.querySelector('.dm-gear').onclick = () => { menu.hidden = !menu.hidden; };

    const view = dm.querySelector('.dm-view');
    const edit = dm.querySelector('.dm-edit');
    const removeIds = new Set();
    const newPics = [];
    dm._editPics = newPics;
    const edImgs = dm.querySelector('.ed-imgs');
    const edNew = dm.querySelector('.ed-new');
    const edFile = dm.querySelector('.ed-file');
    const edImgErr = dm.querySelector('.ed-imgerr');
    const eerr = dm.querySelector('.dm-eerr');
    const keptCount = () => p.images.filter((_, i) => !removeIds.has(String(p.imageIds[i]))).length;
    const validNew = () => newPics.filter((x) => !x.error).length;

    const renderEditImages = () => {
      edImgs.innerHTML = p.images.map((src, i) => {
        const id = p.imageIds[i];
        if (removeIds.has(String(id))) return '';
        return `<div class="dm-pic"><img src="${esc(src)}" alt="">${id != null ? `<button type="button" data-id="${id}" aria-label="ลบรูป">✕</button>` : ''}</div>`;
      }).join('');
      edNew.innerHTML = newPics.map((x, i) => (x.error
        ? `<div class="dm-pic bad"><div class="bad-info"><b>${esc(x.file.name)}</b><span>${esc(x.error)}</span></div><button type="button" data-n="${i}" aria-label="ลบรูป">✕</button></div>`
        : `<div class="dm-pic"><img src="${x.url}" alt=""><button type="button" data-n="${i}" aria-label="ลบรูป">✕</button></div>`)).join('');
    };

    const resetEdit = () => {
      dm.querySelector('#edDesc').value = p.desc;
      dm.querySelector('#edPlace').value = p.place;
      dm.querySelector('#edName').value = p.name;
      dm.querySelector('#edContact').value = p.contact;
      removeIds.clear();
      newPics.splice(0).forEach((x) => URL.revokeObjectURL(x.url));
      edImgErr.textContent = '';
      eerr.textContent = '';
      renderEditImages();
    };

    menu.querySelector('[data-act="edit"]').onclick = () => {
      menu.hidden = true;
      renderEditImages();
      view.hidden = true;
      edit.hidden = false;
      dm.querySelector('#edDesc').focus();
    };
    dm.querySelector('.dm-ecancel').onclick = () => { resetEdit(); edit.hidden = true; view.hidden = false; };

    edImgs.onclick = (e) => {
      const b = e.target.closest('button[data-id]');
      if (!b) return;
      removeIds.add(String(b.dataset.id));
      edImgErr.textContent = '';
      renderEditImages();
    };
    edNew.onclick = (e) => {
      const b = e.target.closest('button[data-n]');
      if (!b) return;
      if (newPics[Number(b.dataset.n)].url) URL.revokeObjectURL(newPics[Number(b.dataset.n)].url);
      newPics.splice(Number(b.dataset.n), 1);
      edImgErr.textContent = '';
      eerr.textContent = '';
      renderEditImages();
    };
    dm.querySelector('.ed-add').onclick = () => {
      if (keptCount() + validNew() >= MAX_IMAGES) { edImgErr.textContent = `แนบได้สูงสุด ${MAX_IMAGES} รูป`; return; }
      edFile.click();
    };
    edFile.onchange = () => {
      let msg = '';
      for (const f of Array.from(edFile.files)) {
        if (!ALLOWED_IMAGE_TYPES.includes(f.type)) {
          msg = 'กรุณาส่งไฟล์ชนิด PNG, JPEG หรือ WEBP เท่านั้น';
          newPics.push({ file: f, error: msg });
          continue;
        }
        if (f.size > MAX_IMAGE_BYTES) {
          msg = 'ไฟล์ใหญ่เกิน 5 MB';
          newPics.push({ file: f, error: msg });
          continue;
        }
        if (keptCount() + validNew() >= MAX_IMAGES) { msg = `แนบได้สูงสุด ${MAX_IMAGES} รูป`; break; }
        newPics.push({ file: f, url: URL.createObjectURL(f) });
      }
      edImgErr.textContent = msg;
      edFile.value = '';
      renderEditImages();
    };

    dm.querySelector('.dm-esave').onclick = async (e) => {
      const v = {
        desc: dm.querySelector('#edDesc').value.trim(),
        place: dm.querySelector('#edPlace').value.trim(),
        name: dm.querySelector('#edName').value.trim(),
        contact: dm.querySelector('#edContact').value.trim(),
      };
      if (!v.desc) { eerr.textContent = 'กรุณาใส่รายละเอียด'; return; }
      if (!v.place) { eerr.textContent = 'กรุณาใส่สถานที่'; return; }
      if (!v.name) { eerr.textContent = 'กรุณาใส่ชื่อ'; return; }
      if (!v.contact) { eerr.textContent = 'กรุณาใส่ช่องทางติดต่อ'; return; }
      if (newPics.some((x) => x.error)) {
        eerr.textContent = 'มีรูปที่ไม่ถูกต้อง กรุณาลบรูปนั้นออกก่อนบันทึก';
        return;
      }
      eerr.textContent = '';
      e.target.disabled = true;
      try {
        const fd = new FormData();
        fd.append('request', new Blob([JSON.stringify({
          type: p.type,
          title: v.desc.slice(0, 100),
          description: v.desc,
          location: v.place,
          contactName: v.name,
          contactInfo: v.contact,
        })], { type: 'application/json' }));
        newPics.forEach((x) => fd.append('newImages', x.file));
        removeIds.forEach((id) => fd.append('removeImageIds', id));
        const response = await fetch(`${API_BASE_URL}/posts/${p.id}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: fd,
        });
        if (!response.ok) {
          eerr.textContent = await errorText(response, 'แก้ไขโพสต์ไม่สำเร็จ', {
            403: 'คุณไม่มีสิทธิ์แก้ไขโพสต์นี้',
            404: 'ไม่พบโพสต์ (อาจถูกลบไปแล้ว)',
          });
          e.target.disabled = false;
          return;
        }
        Object.assign(p, v);
        const refreshed = await loadPosts();
        const i = refreshed ? posts.findIndex((x) => String(x.id) === String(p.id)) : posts.indexOf(p);
        if (i >= 0) openDetail(i); else closeDetail();
      } catch (error) {
        console.error('Network Error:', error);
        eerr.textContent = 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้';
        e.target.disabled = false;
      }
    };

    menu.querySelector('[data-act="del"]').onclick = () => {
      menu.hidden = true;
      const cf = document.createElement('div');
      cf.className = 'cf';
      cf.innerHTML = `
        <div class="cf-box" role="alertdialog" aria-modal="true">
          <p>ต้องการลบโพสต์นี้ใช่หรือไม่?</p>
          <div class="dm-cferr err"></div>
          <div class="cf-act">
            <button type="button" class="cf-no">ยกเลิก</button>
            <button type="button" class="cf-yes danger">ยืนยัน</button>
          </div>
        </div>`;
      dm.appendChild(cf);
      let busy = false;
      cf.onclick = (ev) => { if (ev.target === cf && !busy) cf.remove(); };
      cf.querySelector('.cf-no').onclick = () => { if (!busy) cf.remove(); };
      cf.querySelector('.cf-yes').onclick = async (ev) => {
        if (busy) return;
        busy = true;
        const yes = ev.target;
        yes.disabled = true;
        cf.querySelector('.cf-no').disabled = true;
        try {
          const response = await fetch(`${API_BASE_URL}/posts/${p.id}`, {
            method: 'DELETE',
            headers: authHeaders(),
          });
          if (!response.ok) {
            cf.querySelector('.dm-cferr').textContent = await errorText(response, 'ลบโพสต์ไม่สำเร็จ', {
              403: 'คุณไม่มีสิทธิ์ลบโพสต์นี้',
              404: 'ไม่พบโพสต์ (อาจถูกลบไปแล้ว)',
            });
            busy = false;
            yes.disabled = false;
            cf.querySelector('.cf-no').disabled = false;
            return;
          }
          const i = posts.indexOf(p);
          if (i >= 0) posts.splice(i, 1);
          closeDetail();
          render();
          notify('ลบโพสต์สำเร็จ');
        } catch (error) {
          console.error('Network Error:', error);
          cf.querySelector('.dm-cferr').textContent = 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้';
          busy = false;
          yes.disabled = false;
          cf.querySelector('.cf-no').disabled = false;
        }
      };
    };
  }

  const refreshBadge = () => { dm.querySelector('.dm-status').innerHTML = statusBadge(p); };

  const claimsBox = dm.querySelector('.dm-claims');
  const loadClaims = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/posts/${p.id}/claims`, { headers: authHeaders() });
      if (!response.ok) throw new Error(await errorText(response, 'โหลดรายการคำขอไม่สำเร็จ', { 403: 'คุณไม่ใช่เจ้าของโพสต์นี้', 404: 'ไม่พบโพสต์ (อาจถูกลบไปแล้ว)' }));
      const claims = (await response.json()).filter((c) => String(c.status).toLowerCase() !== 'rejected');
      if (!claimsBox.isConnected) return;
      renderClaims(claims);
    } catch (error) {
      console.error('Load claims error:', error);
      if (claimsBox.isConnected) claimsBox.innerHTML = `<div class="err">${esc(error.message || 'โหลดรายการคำขอไม่สำเร็จ')}</div>`;
    }
  };

  const renderClaims = (claims) => {
    if (!claims.length) {
      claimsBox.innerHTML = '<div class="dm-owner-hint">ยังไม่มีผู้ติดต่อ</div>';
      return;
    }
    const hasPending = claims.some((c) => String(c.status).toLowerCase() === 'pending');
    claimsBox.innerHTML = `
      <div class="claims-title">คำขอรับสิ่งของ (${claims.length})</div>
      ${hasPending ? '<p class="dm-owner-msg">โปรดยืนยันว่าผู้รับได้มารับสิ่งของจากคุณแล้ว</p>' : ''}
      ${claims.map((c) => {
        const st = String(c.status).toLowerCase();
        const time = c.createdAt
          ? new Date(c.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '';
        const imgs = (c.imageUrls || []).map((u) => `<img src="${esc(fullImageUrl(u))}" alt="">`).join('');
        const act = st === 'pending'
          ? `<button type="button" class="btn dm-grant" data-id="${c.id}">ยืนยันปิดโพสต์</button>
             <button type="button" class="dm-reject" data-id="${c.id}">ปฏิเสธคำขอ</button>`
          : st === 'confirmed'
            ? '<button type="button" class="btn dm-grant" disabled>ยืนยันปิดโพสต์</button><span class="dm-check" aria-label="ยืนยันแล้ว">✓</span>'
            : '<span class="dm-owner-hint">ปฏิเสธแล้ว</span>';
        return `
          <div class="claim${st === 'rejected' ? ' rejected' : ''}">
            <div class="meta"><b>${esc(c.contactName)}</b> · ${esc(c.contactInfo)}</div>
            ${time ? `<div class="meta">ส่งคำขอเมื่อ ${esc(time)}</div>` : ''}
            ${imgs ? `<div class="claim-imgs">${imgs}</div>` : ''}
            <div class="dm-owner-act">${act}</div>
          </div>`;
      }).join('')}
      <div class="err dm-grant-err"></div>`;
  };

  const actOnClaim = async (btn, action) => {
    const gerr = claimsBox.querySelector('.dm-grant-err');
    gerr.textContent = '';
    claimsBox.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    try {
      const response = await fetch(`${API_BASE_URL}/claims/${btn.dataset.id}/${action}`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!response.ok) {
        gerr.textContent = await errorText(response, 'ทำรายการไม่สำเร็จ', {
          403: 'คุณไม่ใช่เจ้าของโพสต์นี้',
          404: 'ไม่พบคำขอนี้ (อาจถูกปิดไปแล้ว)',
          409: 'ทำรายการไม่ได้ เพราะโพสต์ไม่ได้อยู่ในสถานะรอยืนยัน หรือคำขอนี้ไม่ได้อยู่ในสถานะ pending แล้ว',
        });
        loadClaims();
        return;
      }
      await loadPosts();
      const i = posts.findIndex((x) => String(x.id) === String(p.id));
      if (i >= 0) openDetail(i); else closeDetail();
    } catch (error) {
      console.error('Network Error:', error);
      gerr.textContent = 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้';
      loadClaims();
    }
  };
  if (claimsBox) {
    claimsBox.onclick = (e) => {
      const g = e.target.closest('.dm-grant:not([disabled])');
      const r = e.target.closest('.dm-reject');
      if (g) actOnClaim(g, 'confirm');
      else if (r) actOnClaim(r, 'reject');
    };
    loadClaims();
  }

  const ctBtn = dm.querySelector('.dm-ctbtn');
  const form = dm.querySelector('.dm-form');
  const errBox = dm.querySelector('.dm-err');
  const result = dm.querySelector('.dm-contact .ctv');
  const confirm = async () => {
    const contactName = dm.querySelector('#dmName').value.trim();
    const contactInfo = dm.querySelector('#dmInfo').value.trim();
    if (!contactName) { errBox.textContent = 'กรุณากรอกชื่อ'; return; }
    if (!contactInfo) { errBox.textContent = 'กรุณากรอกช่องทางติดต่อ'; return; }
    errBox.textContent = '';
    if (pics.length === 0) { picErr.textContent = 'โปรดลงภาพยืนยัน'; return; }
    const btn = dm.querySelector('.dm-confirm');
    btn.disabled = true;
    try {
      const fd = new FormData();
      fd.append('req', new Blob([JSON.stringify({ contactName, contactInfo })], { type: 'application/json' }));
      pics.forEach((x) => fd.append('photos', x.file));
      const response = await fetch(`${API_BASE_URL}/posts/${p.id}/claims`, {
        method: 'POST',
        headers: authHeaders(),
        body: fd,
      });
      if (!response.ok) {
        errBox.textContent = await errorText(response, 'ส่งข้อมูลไม่สำเร็จ');
        btn.disabled = false;
        return;
      }
    } catch (error) {
      console.error('Network Error:', error);
      errBox.textContent = 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้';
      btn.disabled = false;
      return;
    }
    if (p.status === 'open') p.status = 'pending';
    refreshBadge();
    render();
    form.hidden = true;
    result.hidden = false;
  };
  ctBtn.onclick = () => {
    ctBtn.hidden = true;
    form.hidden = false;
    dm.querySelector('.dm-contact').classList.add('open');
    dm.querySelector('#dmName').focus();
    form.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  const FULL_MSG = 'ส่งภาพครบแล้ว หากต้องการส่งเพิ่มให้ติดต่อเจ้าของเอง';
  const pics = [];
  dm._pics = pics;
  const picsBox = dm.querySelector('.dm-pics');
  const addPicBtn = dm.querySelector('.dm-addpic');
  const picFile = dm.querySelector('.dm-picfile');
  const picErr = dm.querySelector('.dm-pic-err');
  const renderPics = () => {
    picsBox.innerHTML = pics.map((x, i) =>
      `<div class="dm-pic"><img src="${x.url}" alt=""><button type="button" data-i="${i}" aria-label="ลบรูป">✕</button></div>`).join('');
  };
  addPicBtn.onclick = () => {
    if (pics.length >= 2) { picErr.textContent = FULL_MSG; return; }
    picFile.click();
  };
  picFile.onchange = () => {
    let msg = '';
    for (const f of Array.from(picFile.files)) {
      if (!ALLOWED_IMAGE_TYPES.includes(f.type)) { msg = 'กรุณาส่งไฟล์ชนิด PNG, JPEG หรือ WEBP เท่านั้น'; continue; }
      if (f.size > MAX_IMAGE_BYTES) { msg = 'ไฟล์ใหญ่เกิน 5 MB'; continue; }
      if (pics.length >= 2) { msg = FULL_MSG; break; }
      pics.push({ file: f, url: URL.createObjectURL(f) });
    }
    picErr.textContent = msg;
    picFile.value = '';
    renderPics();
  };
  picsBox.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    URL.revokeObjectURL(pics[Number(b.dataset.i)].url);
    pics.splice(Number(b.dataset.i), 1);
    picErr.textContent = '';
    renderPics();
  };
  dm.querySelector('.dm-confirm').onclick = confirm;
  ['#dmName', '#dmInfo'].forEach((sel) => {
    dm.querySelector(sel).onkeydown = (e) => { if (e.key === 'Enter') confirm(); };
  });
  document.addEventListener('keydown', dmKey);
}

document.addEventListener('click', (e) => {
  const zoom = e.target.closest('.dm-gallery img, .claim-imgs img');
  if (zoom) {
    const g = zoom.parentNode;
    const imgs = Array.from(g.children);
    openLightbox(imgs.map((el) => el.getAttribute('src')), imgs.indexOf(zoom), g);
    return;
  }

  if (e.target.closest('.g-btn')) return;
  const card = e.target.closest('.post');
  if (card) openDetail(Number(card.dataset.i));
});

render();
setType('lost');

async function restoreSession() {
  const token = localStorage.getItem(SESSION_TOKEN_KEY);
  const email = localStorage.getItem(SESSION_EMAIL_KEY);
  const displayName = localStorage.getItem(SESSION_DISPLAY_NAME_KEY);
  if (!token) {
    localStorage.removeItem(SESSION_EMAIL_KEY);
    localStorage.removeItem(SESSION_DISPLAY_NAME_KEY);
    show('login');
    return;
  }

  $('who').textContent = displayName || email || '';
  await loadPosts();
  show('home');
}

restoreSession();