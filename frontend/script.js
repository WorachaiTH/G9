const $ = (id) => document.getElementById(id);

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  }[c]));

const ALLOWED_EMAIL = /^[a-z0-9._%+-]+@dome\.tu\.ac\.th$/;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const ICONS = {
  wallet: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M16 12h5v3h-5a1.5 1.5 0 0 1 0-3z"/>',
  key:    '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v4"/>',
  phone:  '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  bag:    '<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
};

let photo = null;
let type = 'lost';
let tab = 'lost';

const posts = [
  
];

function postCard(p, index) {
  const isLost = p.type === 'lost';
  const cover = p.img
    ? `<img src="${p.img}" alt="" style="width:100%;height:100%;object-fit:cover">`
    : `<svg viewBox="0 0 24 24">${ICONS[p.icon || 'bag']}</svg>`;

  return `
    <div class="card post">
      <div class="ph">${cover}</div>
      <div class="pb">
        <p><b>${esc(p.desc)}</b></p>
        <div class="meta">${isLost ? 'หายที่' : 'พบที่'}: ${esc(p.place)}</div>
        <div class="meta">เวลา: ${p.time}</div>
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

function show(view) {
  $('login').hidden = view !== 'login';
  $('home').hidden = view !== 'home';
  $('form').hidden = view !== 'form';
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
  photo = null;
  ['desc', 'loc', 'name', 'tel', 'file'].forEach((id) => ($(id).value = ''));
  $('prev').hidden = true;
  $('drop').hidden = false;
  ['eImg', 'eDesc', 'eLoc', 'eName', 'eTel'].forEach((id) => ($(id).textContent = ''));
}

function handleImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    $('eImg').textContent = 'กรุณาเลือกไฟล์รูปภาพ';
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    $('eImg').textContent = 'ไฟล์ใหญ่เกิน 10 MB';
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
  reader.readAsDataURL(file);
}

function submitPost() {
  const v = {
    desc: $('desc').value.trim(),
    place: $('loc').value.trim(),
    name: $('name').value.trim(),
    contact: $('tel').value.trim(),
  };

  const errors = {
    eImg:  photo || type === 'lost' ? '' : 'กรุณาเพิ่มรูปภาพ',
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

  posts.unshift({
    type,
    img: photo,
    icon: type === 'lost' ? 'bag' : 'wallet',
    ...v,
    time: 'วันนี้ ' + new Date().toTimeString().slice(0, 5),
  });
  resetForm();
  render();
  setTab(type);
  $('toast').hidden = false;
  show('home');
}

function showLoginMessage(text) {
  $('lgmsg').textContent = text;
  $('lgmsg').hidden = false;
}

function login() {
  const email = $('em').value.trim().toLowerCase();
  const password = $('pw').value;
  $('em').value = email;

  let emailError = '';
  if (!email) emailError = 'กรุณากรอกอีเมล';
  else if (!ALLOWED_EMAIL.test(email)) emailError = 'ใช้ได้เฉพาะอีเมล @dome.tu.ac.th เท่านั้น';
  const passwordError = password ? '' : 'กรุณากรอกรหัสผ่าน';

  $('eEm').textContent = emailError;
  $('ePw').textContent = passwordError;
  if (emailError || passwordError) return;

  $('lgmsg').hidden = true;
  $('who').textContent = email;
  $('pw').value = '';
  show('home');
}

$('loginBtn').onclick = login;
['em', 'pw'].forEach((id) => {
  $(id).onkeydown = (e) => { if (e.key === 'Enter') login(); };
});
$('em').onblur = () => ($('em').value = $('em').value.trim().toLowerCase());
$('eye').onclick = () => {
  $('pw').type = $('pw').type === 'password' ? 'text' : 'password';
};
$('forgot').onclick = (e) => {
  e.preventDefault();
  showLoginMessage('ฟีเจอร์นี้ต้องเชื่อมระบบของมหาวิทยาลัยจริง (เวอร์ชันตัวอย่างยังไม่รองรับ)');
};
$('logout').onclick = () => { $('em').value = ''; show('login'); };

$('tL').onclick = () => setTab('lost');
$('tF').onclick = () => setTab('found');
$('add').onclick = () => { $('toast').hidden = true; setType(tab); show('form'); };

$('sL').onclick = () => setType('lost');
$('sF').onclick = () => setType('found');
$('back').onclick = () => { resetForm(); show('home'); };
$('drop').onclick = $('rm').onclick = () => $('file').click();
$('drop').onkeydown = (e) => { if (e.key === 'Enter') $('file').click(); };
$('file').onchange = handleImage;
$('post').onclick = submitPost;

render();
setType('lost');
