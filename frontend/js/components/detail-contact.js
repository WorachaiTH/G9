import { esc, errorText, fullImageUrl, notify } from '../utils.js';
import { API_BASE_URL, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES } from '../config.js';
import { posts, statusBadge } from '../posts.js';
import { render, loadPosts } from './feed.js';
import { openDetail, closeDetail } from './detail.js';

// ฟอร์มติดต่อเจ้าของโพสต์ + แนบรูปยืนยัน
export function setupContactForm(dm, p, authHeaders) {
  const refreshBadge = () => { dm.querySelector('.dm-status').innerHTML = statusBadge(p); };

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
}
