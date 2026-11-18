import { $ } from '../utils.js';
import { API_BASE_URL, EMPLOYEE_ID_PATTERN, SESSION_EMAIL_KEY, SESSION_TOKEN_KEY, SESSION_EMPLOYEE_ID_KEY, SESSION_DISPLAY_NAME_KEY } from '../config.js';
import { show } from '../views.js';
import { loadPosts } from './feed.js';

function showLoginMessage(text) {
  $('lgmsg').textContent = text;
  $('lgmsg').hidden = false;
}

async function login() {
  const employeeId = $('employeeId').value.trim();
  const password = $('pw').value;
  $('employeeId').value = employeeId;

  let employeeIdError = '';
  if (!employeeId) employeeIdError = 'กรุณากรอกรหัสประจำตัวบุคลากร';
  else if (!EMPLOYEE_ID_PATTERN.test(employeeId)) employeeIdError = 'รหัสประจำตัวบุคลากรต้องเป็นตัวเลขเท่านั้น';

  const hasInvalidChar = /[^a-zA-Z0-9]/.test(password);
  let passwordError = '';
  if (!password) passwordError = 'กรุณากรอกรหัสผ่าน';
  else if (hasInvalidChar) passwordError = 'รหัสผ่านต้องเป็นภาษาอังกฤษและตัวเลขเท่านั้น';

  $('eEmployeeId').textContent = employeeIdError;
  $('ePw').textContent = passwordError;
  if (employeeIdError || passwordError) return;

  $('lgmsg').hidden = true;
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, password }),
    });
    const text = await response.text();
    let data = {};
    try { data = JSON.parse(text); } catch { data = { message: text }; }
    if (!response.ok || !data.token) throw new Error(data.message || 'รหัสประจำตัวหรือรหัสผ่านไม่ถูกต้อง');

    const accountEmail = data.email || data.employeeId;
    const displayName = data.displayName || accountEmail;
    $('who').textContent = displayName;
    $('pw').value = '';
    localStorage.setItem(SESSION_EMAIL_KEY, accountEmail);
    localStorage.setItem(SESSION_EMPLOYEE_ID_KEY, String(data.employeeId || employeeId));
    localStorage.setItem(SESSION_DISPLAY_NAME_KEY, displayName);
    localStorage.setItem(SESSION_TOKEN_KEY, data.token);
    await loadPosts();
    show('home');
  } catch (error) {
    showLoginMessage(error.message || 'ไม่สามารถเชื่อมต่อระบบได้');
  }
}

$('loginBtn').onclick = login;
['employeeId', 'pw'].forEach((id) => {
  $(id).onkeydown = (e) => { if (e.key === 'Enter') login(); };
});
$('employeeId').onblur = () => ($('employeeId').value = $('employeeId').value.trim());

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
  localStorage.removeItem(SESSION_EMAIL_KEY);
  localStorage.removeItem(SESSION_EMPLOYEE_ID_KEY);
  localStorage.removeItem(SESSION_TOKEN_KEY);
  localStorage.removeItem(SESSION_DISPLAY_NAME_KEY);
  $('employeeId').value = '';
  $('who').textContent = '';
  show('login');
};
