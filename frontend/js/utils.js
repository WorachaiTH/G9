// ฟังก์ชันช่วยทั่วไป
import { API_ORIGIN } from './config.js';

export const $ = (id) => document.getElementById(id);

export const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  }[c]));

export function notify(text) {
  const el = document.createElement('div');
  el.className = 'flash';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

export const fullImageUrl = (u) => (/^(https?:|data:)/.test(u) ? u : API_ORIGIN + u);

export async function errorText(response, fallback, overrides = {}) {
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
