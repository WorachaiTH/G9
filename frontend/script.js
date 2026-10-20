const $ = (id) => document.getElementById(id);

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  }[c]));

const STUDENT_ID = /^\d{10}$/;
const PASSWORD_RE = /^\d{13}$/;
const EMAIL_DOMAIN = '@dome.tu.ac.th';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 5;
const API_ORIGIN = 'http://localhost:8080';
const API_BASE_URL = `${API_ORIGIN}/api`;
const SESSION_EMAIL_KEY = 'lostAndFoundEmail';
const SESSION_TOKEN_KEY = 'lostAndFoundToken';

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
`;
document.head.appendChild(extraStyle);

$('file').multiple = true;

let photoFiles = [];
let type = 'lost';
let tab = 'lost';

const posts = [];

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
    <div class="card post">
      <div class="ph">${cover}</div>
      <div class="pb">
        <div class="post-desc-bg">
          <p><b>${esc(p.desc)}</b></p>
        </div>
        <div class="meta">${isLost ? 'หายที่' : 'พบที่'}: ${esc(p.place)}</div>
        <div class="meta">เวลา: ${esc(p.time)}</div>
        <button class="ct" data-i="${index}">${isLost ? 'ติดต่อเจ้าของ' : 'ติดต่อผู้พบ'}</button>
        <div class="ctv" id="c${index}" hidden>${esc(p.name)} · ${esc(p.contact)}</div>
      </div>
    </div>`;
}

function normalizePost(post) {
  const isFound = String(post.type).toLowerCase() === 'found';
  return {
    type: isFound ? 'found' : 'lost',
    images: (post.images || []).map((im) => API_ORIGIN + im.imageUrl),
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
  [['lost', 'L'], ['found', 'F']].forEach(([kind, key]) => {
    const items = posts
      .map((p, index) => ({ p, index }))
      .filter((x) => x.p.type === kind);

    $('feed' + key).innerHTML =
      items.map((x) => postCard(x.p, x.index)).join('') ||
      '<p class="meta">ยังไม่มีรายการ</p>';
    $('n' + key).textContent = items.length;
  });

  document.querySelectorAll('.ct').forEach((btn) => {
    btn.onclick = () => {
      btn.hidden = true;
      $('c' + btn.dataset.i).hidden = false;
    };
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
    if (!['image/jpeg', 'image/png'].includes(file.type)) { message = 'รองรับเฉพาะไฟล์ JPG หรือ PNG'; continue; }
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
      const errMessage = await response.text();
      alert(errMessage || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
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
  const studentId = $('em').value.trim();
  const password = $('pw').value;
  const email = studentId + EMAIL_DOMAIN;

  let idError = '';
  if (!studentId) idError = 'กรุณากรอกรหัสนักศึกษา';
  else if (!STUDENT_ID.test(studentId)) idError = 'รหัสนักศึกษาต้องเป็นตัวเลข 10 หลัก';

  let passwordError = '';
  if (!password) passwordError = 'กรุณากรอกรหัสผ่าน';
  else if (!PASSWORD_RE.test(password)) passwordError = 'รหัสผ่านต้องเป็นตัวเลข 13 หลักเท่านั้น';

  $('eEm').textContent = idError;
  $('ePw').textContent = passwordError;
  if (idError || passwordError) return;

  $('lgmsg').hidden = true;
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const text = await response.text();
    let data = {};
    try { data = JSON.parse(text); } catch { data = { message: text }; }
    if (!response.ok || !data.token) throw new Error(data.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');

    $('who').textContent = data.email;
    $('pw').value = '';
    localStorage.setItem(SESSION_EMAIL_KEY, data.email);
    localStorage.setItem(SESSION_TOKEN_KEY, data.token);
    await loadPosts();
    show('home');
  } catch (error) {
    showLoginMessage(error.message || 'ไม่สามารถเชื่อมต่อระบบได้');
  }
}

$('loginBtn').onclick = login;
['em', 'pw'].forEach((id) => {
  $(id).onkeydown = (e) => { if (e.key === 'Enter') login(); };
});
$('em').oninput = (e) => {
  const raw = e.target.value;
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  e.target.value = digits;
  $('eEm').textContent = raw !== digits ? 'กรุณากรอกตัวเลข 10 หลักเท่านั้น' : '';
};

$('pw').oninput = (e) => {
  const raw = e.target.value;
  const digits = raw.replace(/\D/g, '').slice(0, 13);
  e.target.value = digits;
  $('ePw').textContent = raw !== digits ? 'กรุณากรอกตัวเลข 13 หลักเท่านั้น' : '';
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
  $('em').value = '';
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
  document.body.style.overflow = '';
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

document.addEventListener('click', (e) => {
  const img = e.target.closest('.gallery img');
  if (!img) return;
  const g = img.parentNode;
  const imgs = Array.from(g.children);
  openLightbox(imgs.map((el) => el.getAttribute('src')), imgs.indexOf(img), g);
});

render();
setType('lost');

async function restoreSession() {
  const token = localStorage.getItem(SESSION_TOKEN_KEY);
  const email = localStorage.getItem(SESSION_EMAIL_KEY);
  if (!token) {
    localStorage.removeItem(SESSION_EMAIL_KEY);
    show('login');
    return;
  }

  $('who').textContent = email || '';
  await loadPosts();
  show('home');
}

restoreSession();