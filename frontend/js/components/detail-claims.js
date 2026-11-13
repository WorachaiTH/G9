import { esc, errorText, fullImageUrl, notify } from '../utils.js';
import { API_BASE_URL, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES } from '../config.js';
import { posts, statusBadge } from '../posts.js';
import { render, loadPosts } from './feed.js';
import { openDetail, closeDetail } from './detail.js';

// รายการคำขอรับของ (เฉพาะเจ้าของโพสต์)
export function setupClaims(dm, p, authHeaders) {
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
}
