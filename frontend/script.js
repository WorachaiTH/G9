const $ = (id) => document.getElementById(id);

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  }[c]));

const ALLOWED_EMAIL = /^[a-z0-9._%+-]+@dome\.tu\.ac\.th$/;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SESSION_EMAIL_KEY = 'lostAndFoundEmail';
const SESSION_TOKEN_KEY = 'lostAndFoundToken';

const ICONS = {
  wallet: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M16 12h5v3h-5a1.5 1.5 0 0 1 0-3z"/>',
  key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v4"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
};

let photo = null;
let type = 'lost';
let tab = 'lost';

const posts = [];

function postCard(p, index) {
  const isLost = p.type === 'lost';
  const cover = p.img
    ? `<img src="${esc(p.img)}" alt="">`
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
  return {
    type: String(post.type).toLowerCase() === 'found' ? 'found' : 'lost',
    img: post.img || post.imageUrls?.[0] || post.imageUrl || null,
    icon: String(post.type).toLowerCase() === 'found' ? 'wallet' : 'bag',
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
    const response = await fetch('/api/posts');
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

function resetForm() {
  photo = null;
  ['desc', 'loc', 'name', 'tel', 'file'].forEach((id) => ($(id).value = '')); $('prev').hidden = true;
  $('drop').hidden = false;
  ['eImg', 'eDesc', 'eLoc', 'eName', 'eTel'].forEach((id) => ($(id).textContent = ''));
}

function handleImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  const rejectImage = (message) => {
    photo = null;
    $('file').value = '';
    $('prev').hidden = true;
    $('drop').hidden = false;
    $('eImg').textContent = message;
  };

  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    rejectImage('รองรับเฉพาะไฟล์ JPG หรือ PNG');
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    rejectImage('ไฟล์ใหญ่เกิน 5 MB');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    photo = reader.result;
    $('img').src = photo;
    $('prev').hidden = false;
    $('drop').hidden = true;
    $('eImg').textContent = '';
  };
  reader.onerror = () => rejectImage('ไม่สามารถอ่านไฟล์รูปภาพได้');
  reader.readAsDataURL(file);
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
    eImg: photo || type === 'lost' ? '' : 'กรุณาเพิ่มรูปภาพ',
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
    const response = await fetch('/api/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: v.type,
        desc: v.title,
        place: v.location,
        name: v.name,
        contact: v.contact,
        img: photo,
      }),
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
  const email = $('em').value.trim().toLowerCase();
  const password = $('pw').value;
  $('em').value = email;

  let emailError = '';
  if (!email) emailError = 'กรุณากรอกอีเมล';
  else if (!ALLOWED_EMAIL.test(email)) emailError = 'ใช้ได้เฉพาะอีเมล @dome.tu.ac.th เท่านั้น';

  const hasInvalidChar = /[^a-zA-Z0-9]/.test(password);
  let passwordError = '';
  if (!password) passwordError = 'กรุณากรอกรหัสผ่าน';
  else if (hasInvalidChar) passwordError = 'รหัสผ่านต้องเป็นภาษาอังกฤษและตัวเลขเท่านั้น';

  $('eEm').textContent = emailError;
  $('ePw').textContent = passwordError;
  if (emailError || passwordError) return;

  $('lgmsg').hidden = true;
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'เข้าสู่ระบบไม่สำเร็จ');

    $('who').textContent = result.email;
    $('pw').value = '';
    localStorage.setItem(SESSION_EMAIL_KEY, result.email);
    localStorage.setItem(SESSION_TOKEN_KEY, result.token);
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
$('em').onblur = () => ($('em').value = $('em').value.trim().toLowerCase());

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

$('logout').onclick = async () => {
  const token = localStorage.getItem(SESSION_TOKEN_KEY);
  if (token) {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.error('Unable to end server session:', error);
    }
  }
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
$('drop').onclick = $('rm').onclick = () => $('file').click(); $('drop').onkeydown = (e) => { if (e.key === 'Enter') $('file').click(); }; $('file').onchange = handleImage;
$('post').onclick = submitPost;

render();
setType('lost');

async function restoreSession() {
  const token = localStorage.getItem(SESSION_TOKEN_KEY);
  if (!token) {
    localStorage.removeItem(SESSION_EMAIL_KEY);
    show('login');
    return;
  }

  try {
    const response = await fetch('/api/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('กรุณาเข้าสู่ระบบใหม่');
    const result = await response.json();
    if (!ALLOWED_EMAIL.test(result.email)) throw new Error('ข้อมูล session ไม่ถูกต้อง');

    $('who').textContent = result.email;
    localStorage.setItem(SESSION_EMAIL_KEY, result.email);
    await loadPosts();
    show('home');
  } catch (error) {
    localStorage.removeItem(SESSION_EMAIL_KEY);
    localStorage.removeItem(SESSION_TOKEN_KEY);
    show('login');
    showLoginMessage(error.message || 'ไม่สามารถตรวจสอบ session ได้');
  }
}

restoreSession();