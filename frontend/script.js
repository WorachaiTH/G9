const $ = (id) => document.getElementById(id);

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  }[c]));

const ALLOWED_EMAIL = /^[a-z0-9._%+-]+@dome\.tu\.ac\.th$/;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const API_ORIGIN = 'http://localhost:8080';
const API_BASE_URL = `${API_ORIGIN}/api`;

const ICONS = {
  wallet: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M16 12h5v3h-5a1.5 1.5 0 0 1 0-3z"/>',
  key:    '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v4"/>',
  phone:  '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  bag:    '<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
};

let photoFile = null;
let photoPreview = null;
let type = 'lost';
let tab = 'lost';

let posts = [];

// อ่านข้อความ error จาก backend (รองรับทั้ง JSON และข้อความธรรมดา)
async function readMessage(res, fallback) {
  const text = await res.text();
  try {
    return JSON.parse(text).message || fallback;
  } catch {
    return text || fallback;
  }
}

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

async function fetchPosts() {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE_URL}/posts`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });

    if (!res.ok) throw new Error('Failed to fetch posts');

    const data = await res.json();
    data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    posts = data.map((item) => {
      const cover = item.images && item.images.length > 0 ? item.images[0].imageUrl : null;
      return {
        id: item.id,
        type: String(item.type || '').toLowerCase() === 'found' ? 'found' : 'lost',
        desc: item.description || item.title || '',
        place: item.location || '',
        name: item.contactName || 'ผู้แจ้ง',
        contact: item.contactInfo || '',
        time: item.createdAt ? new Date(item.createdAt).toLocaleString('th-TH') : 'ไม่ระบุเวลา',
        img: cover ? API_ORIGIN + cover : null,
        icon: 'bag'
      };
    });

    render();
  } catch (err) {
    console.error('Error fetching posts:', err);
  }
}

function show(view) {
  $('login').hidden = view !== 'login';
  $('home').hidden = view !== 'home';
  $('form').hidden = view !== 'form';
  $('app-nav').hidden = view === 'login';

  $('navHome').classList.toggle('active', view === 'home');
  $('navAdd').classList.toggle('active', view === 'form');

  window.scrollTo(0, 0);
}

function setTab(t) {
  tab = t;
  $('home').dataset.tab = t;
  $('tL').className = t === 'lost' ? 'on l' : '';
  $('tF').className = t === 'found' ? 'on' : '';
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
  photoFile = null;
  photoPreview = null;
  ['desc', 'loc', 'name', 'tel', 'file'].forEach((id) => ($(id).value = ''));
  $('prev').hidden = true;
  $('drop').hidden = false;
  ['eImg', 'eDesc', 'eLoc', 'eName', 'eTel'].forEach((id) => ($(id).textContent = ''));
}

function handleImage(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    $('eImg').textContent = 'รองรับเฉพาะไฟล์ JPG หรือ PNG';
    e.target.value = '';
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    $('eImg').textContent = 'ไฟล์ใหญ่เกิน 5 MB';
    e.target.value = '';
    return;
  }

  photoFile = file;

  const reader = new FileReader();
  reader.onload = () => {
    photoPreview = reader.result;
    $('img').src = photoPreview;
    $('prev').hidden = false;
    $('drop').hidden = true;
    $('eImg').textContent = '';
  };
  reader.readAsDataURL(file);
}

async function submitPost() {
  const v = {
    desc: $('desc').value.trim(),
    place: $('loc').value.trim(),
    name: $('name').value.trim(),
    contact: $('tel').value.trim(),
  };

  const errors = {
    eImg:  photoFile || type === 'lost' ? '' : 'กรุณาเพิ่มรูปภาพ',
    eDesc: v.desc ? '' : 'กรุณาใส่รายละเอียด',
    eLoc:  v.place ? '' : 'กรุณาใส่สถานที่',
    eName: v.name ? '' : 'กรุณาใส่ชื่อ',
    eTel:  v.contact ? '' : 'กรุณาใส่ช่องทางติดต่อ',
  };
  Object.keys(errors).forEach((id) => ($(id).textContent = errors[id]));

  if (Object.values(errors).some(Boolean)) {
    const firstError = document.querySelector('.err:not(:empty)');
    if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  $('post').disabled = true; // กันกดซ้ำ
  try {
    const token = localStorage.getItem('token');
    const formData = new FormData();

    const postData = {
      type,                          // 'lost' หรือ 'found'
      title: v.desc.slice(0, 100),
      description: v.desc,
      location: v.place,
      contactName: v.name,
      contactInfo: v.contact,
      authorEmail: localStorage.getItem('email') || 'anonymous@tu.ac.th'
    };

    formData.append('post', new Blob([JSON.stringify(postData)], { type: 'application/json' }));

    if (photoFile) {
      formData.append('images', photoFile);
    }

    // ห้ามตั้ง Content-Type เอง ให้ browser ใส่ boundary ให้
    const res = await fetch(`${API_BASE_URL}/posts`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData
    });

    if (!res.ok) {
      alert(await readMessage(res, 'สร้างโพสต์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'));
      return;
    }

    await fetchPosts();
    resetForm();
    setTab(type);
    $('toast').hidden = false;
    show('home');
  } catch (err) {
    console.error('Error submitting post:', err);
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
  } finally {
    $('post').disabled = false;
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

  // ลบการเช็คนี้ได้ถ้ารหัสผ่าน TU มีสัญลักษณ์พิเศษ
  const hasInvalidChar = /[^a-zA-Z0-9]/.test(password);
  let passwordError = '';
  if (!password) passwordError = 'กรุณากรอกรหัสผ่าน';
  else if (hasInvalidChar) passwordError = 'รหัสผ่านต้องเป็นภาษาอังกฤษและตัวเลขเท่านั้น';

  $('eEm').textContent = emailError;
  $('ePw').textContent = passwordError;
  if (emailError || passwordError) return;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch { data = { message: text }; }

    if (res.ok && data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('email', email);
      $('lgmsg').hidden = true;
      $('who').textContent = email;
      $('pw').value = '';
      await fetchPosts();
      show('home');
    } else {
      showLoginMessage(data.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }
  } catch (err) {
    console.error('Login error:', err);
    showLoginMessage('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
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

$('logout').onclick = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('email');
  $('em').value = '';
  show('login');
};

$('navHome').onclick = () => show('home');
$('navAdd').onclick = () => {
  $('toast').hidden = true;
  setType(tab);
  show('form');
};

$('tL').onclick = () => setTab('lost');
$('tF').onclick = () => setTab('found');
$('add').onclick = () => {
  $('toast').hidden = true;
  setType(tab);
  show('form');
};

$('sL').onclick = () => setType('lost');
$('sF').onclick = () => setType('found');
$('back').onclick = () => { resetForm(); show('home'); };

$('drop').onclick = $('rm').onclick = () => $('file').click();
$('drop').onkeydown = (e) => { if (e.key === 'Enter') $('file').click(); };
$('file').onchange = handleImage;
$('post').onclick = submitPost;

if (localStorage.getItem('token')) {
  $('who').textContent = localStorage.getItem('email') || '';
  fetchPosts();
  show('home');
} else {
  show('login');
}
setType('lost');