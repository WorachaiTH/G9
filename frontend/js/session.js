// จัดการsession เช็คเจ้าของโพสต์
import { $ } from './utils.js';
import { SESSION_EMAIL_KEY, SESSION_TOKEN_KEY, SESSION_EMPLOYEE_ID_KEY, SESSION_DISPLAY_NAME_KEY, MY_POSTS_KEY } from './config.js';
import { show } from './views.js';
import { loadPosts } from './components/feed.js';

export function myPostsKey() {
  return `${MY_POSTS_KEY}:${localStorage.getItem(SESSION_EMPLOYEE_ID_KEY) || localStorage.getItem(SESSION_EMAIL_KEY) || ''}`;
}

export function myPostIds() {
  try { return JSON.parse(localStorage.getItem(myPostsKey()) || '[]').map(String); } catch { return []; }
}

export function rememberMyPost(id) {
  if (id == null) return;
  const ids = myPostIds();
  if (!ids.includes(String(id))) {
    ids.push(String(id));
    try { localStorage.setItem(myPostsKey(), JSON.stringify(ids)); } catch { /* เต็ม/ปิดใช้งาน ไม่เป็นไร */ }
  }
}

export function isOwner(p) {
  if (typeof p.ownerFlag === 'boolean') return p.ownerFlag;
  const mine = [localStorage.getItem(SESSION_EMAIL_KEY), localStorage.getItem(SESSION_EMPLOYEE_ID_KEY)]
    .filter(Boolean).map((v) => String(v).toLowerCase());
  if (p.authorIds.some((a) => mine.includes(a))) return true;
  return p.id != null && myPostIds().includes(String(p.id));
}

export async function restoreSession() {
  const token = localStorage.getItem(SESSION_TOKEN_KEY);
  const email = localStorage.getItem(SESSION_EMAIL_KEY);
  const displayName = localStorage.getItem(SESSION_DISPLAY_NAME_KEY);
  if (!token) {
    localStorage.removeItem(SESSION_EMAIL_KEY);
    localStorage.removeItem(SESSION_DISPLAY_NAME_KEY);
    show('login');
    return;
  }

  $('who').textContent = displayName || email || '';
  await loadPosts();
  show('home');
}

