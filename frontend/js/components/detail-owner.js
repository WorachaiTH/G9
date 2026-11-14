import { esc, errorText, fullImageUrl, notify } from '../utils.js';
import { API_BASE_URL, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES } from '../config.js';
import { posts, statusBadge } from '../posts.js';
import { render, loadPosts } from './feed.js';
import { openDetail, closeDetail } from './detail.js';

// แก้ไข/ลบโพสต์ (เมนูเฉพาะเจ้าของ)
export function setupOwnerMenu(dm, p, authHeaders) {
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
}
