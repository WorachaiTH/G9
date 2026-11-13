import { $, esc, errorText } from '../utils.js';
import { API_BASE_URL, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES, SESSION_EMAIL_KEY, SESSION_TOKEN_KEY } from '../config.js';
import { posts, normalizePost } from '../posts.js';
import { rememberMyPost } from '../session.js';
import { show } from '../views.js';
import { render, loadPosts, setTab } from './feed.js';
// ฟอร์มเพิ่มโพสต์
$('file').multiple = true;

let photoFiles = [];
let type = 'lost';

export function setType(t) {
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

export function renderPreviews() {
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

export function resetForm() {
  photoFiles.forEach((p) => URL.revokeObjectURL(p.url));
  photoFiles = [];
  ['desc', 'loc', 'name', 'tel', 'file'].forEach((id) => ($(id).value = ''));
  ['eImg', 'eDesc', 'eLoc', 'eName', 'eTel'].forEach((id) => ($(id).textContent = ''));
  renderPreviews();
}

export function handleImage(e) {
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

export async function submitPost() {
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
    rememberMyPost(savedPost.id);
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

$('sL').onclick = () => setType('lost');
$('sF').onclick = () => setType('found'); $('back').onclick = () => { resetForm(); show('home'); };
$('drop').onclick = () => $('file').click();
$('drop').onkeydown = (e) => { if (e.key === 'Enter') $('file').click(); };
$('file').onchange = handleImage;
$('post').onclick = submitPost;
