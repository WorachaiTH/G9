import { esc } from '../utils.js';
import { SESSION_TOKEN_KEY, MAX_IMAGES } from '../config.js';
import { posts, statusBadge, purgeNote } from '../posts.js';
import { isOwner } from '../session.js';
import { lb } from './lightbox.js';
import { setupOwnerMenu } from './detail-owner.js';
import { setupClaims } from './detail-claims.js';
import { setupContactForm } from './detail-contact.js';

export let dm = null;

export function dmKey(e) {
  if (e.key === 'Escape' && !lb) closeDetail();
}

export function closeDetail() {
  if (!dm) return;
  (dm._pics || []).forEach((x) => URL.revokeObjectURL(x.url));
  (dm._editPics || []).forEach((x) => URL.revokeObjectURL(x.url));
  dm.remove();
  dm = null;
  if (!lb) document.body.style.overflow = '';
  document.removeEventListener('keydown', dmKey);
}

export function openDetail(index) {
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

  setupOwnerMenu(dm, p, authHeaders);
  setupClaims(dm, p, authHeaders);
  setupContactForm(dm, p, authHeaders);
  document.addEventListener('keydown', dmKey);
}
