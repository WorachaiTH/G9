(() => {
  const PROFILE_KEY = 'lostAndFoundProfile';
  const TYPE_LABEL = { lost: 'ของหาย', found: 'เจอของ' };

  let phase = 'idle'; 
  let errorText = '';
  let mine = [];      
  let seq = 0;        

  
  function readSaved() {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null') || {};
    } catch {
      return {};
    }
  }

 
  function employeeIdFromToken(token) {
    try {
      const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return String(JSON.parse(atob(part + '='.repeat((4 - (part.length % 4)) % 4))).sub || '');
    } catch {
      return '';
    }
  }

  function currentProfile() {
    const saved = readSaved();
    const sessionEmail = localStorage.getItem(SESSION_EMAIL_KEY) || ''; 
    const employeeId = String(
      saved.employeeId ||
      employeeIdFromToken(localStorage.getItem(SESSION_TOKEN_KEY) || '') ||
      (/^\d+$/.test(sessionEmail) ? sessionEmail : '')
    );
    const email = saved.email || (sessionEmail.includes('@') ? sessionEmail : '');
    return {
      name: localStorage.getItem(SESSION_DISPLAY_NAME_KEY) || email || employeeId,
      employeeId,
      faculty: saved.faculty || '',
      department: saved.department || '',
      email,
      phone: saved.phone || '',
    };
  }

  function setLine(id, text) {
    $(id).textContent = text;
    $(id).hidden = !text;
  }

  function renderHeader() {
    const me = currentProfile();
    $('prName').textContent = me.name;
    $('prId').textContent = me.employeeId;
    setLine('prFaculty', me.faculty);
    setLine('prDept', me.department ? (/^สาขา/.test(me.department) ? me.department : `สาขา : ${me.department}`) : '');

    $('prMail').textContent = me.email;
    $('prMail').href = me.email ? `mailto:${me.email}` : '#';
    $('prMailRow').hidden = !me.email;
    $('prPhone').textContent = me.phone;
    $('prPhoneRow').hidden = !me.phone;
    $('prContact').hidden = !me.email && !me.phone;
  }

  
  async function loadMine() {
    const mySeq = ++seq;
    const id = currentProfile().employeeId;
    phase = 'loading';
    renderFeed();
    try {
      const response = await fetch(`${API_BASE_URL}/posts`);
      if (mySeq !== seq) return;
      if (!response.ok) throw new Error(`โหลดโพสต์ไม่สำเร็จ (${response.status})`);
      const data = await response.json();
      if (mySeq !== seq) return;
      if (!Array.isArray(data)) throw new Error('รูปแบบข้อมูลโพสต์จาก backend ไม่ถูกต้อง');
      mine = id ? data.filter((p) => String(p.authorEmail) === id).map(normalizePost) : [];
      phase = 'ready';
    } catch (error) {
      if (mySeq !== seq) return;
      mine = [];
      phase = 'error';
      errorText = error instanceof TypeError
        ? 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้'
        : error instanceof SyntaxError
          ? 'รูปแบบข้อมูลโพสต์จาก backend ไม่ถูกต้อง'
          : (error.message || 'โหลดโพสต์ไม่สำเร็จ');
    }
    renderFeed();
  }

  
  const IMAGE_ICON = `<svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#B85032" />
      <path d="M11 31l9-10 6 7 4-4 7 7z" fill="#F3E2DC" /><circle cx="31" cy="17" r="3.2" fill="#F3E2DC" /></svg>`;
  const PIN_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zm0-9a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/></svg>';
  const CLOCK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm.8 5v5.2l4 2.4-.8 1.3-4.8-2.9V7h1.6z"/></svg>';

 
  function coverHtml(p) {
    const n = p.images.length;
    if (!n) return IMAGE_ICON;
    return `<div class="gallery-wrap">
        <div class="gallery">${p.images.map((src) => `<img src="${esc(src)}" alt="">`).join('')}</div>
        ${n > 1 ? `<button type="button" class="g-btn prev" data-dir="-1" aria-label="รูปก่อนหน้า">‹</button>
                   <button type="button" class="g-btn next" data-dir="1" aria-label="รูปถัดไป">›</button>
                   <span class="g-count">1/${n}</span>` : ''}
      </div>`;
  }

  function cardHtml(p) {
    return `<article class="pr-card">
      <div class="ph pr-cover">
        <span class="pr-pill">${TYPE_LABEL[p.type === 'lost' ? 'lost' : 'found']}</span>
        ${coverHtml(p)}
      </div>
      <div class="pr-body">
        <p class="pr-name">${esc(p.desc)}</p>
        <div class="pr-meta">${PIN_ICON}<span>${esc(p.place)}</span></div>
        <div class="pr-meta">${CLOCK_ICON}<span>${esc(p.time)}</span></div>
        <button type="button" class="pr-btn">ติดต่อเจ้าของโพสต์</button>
        <div class="pr-ctv" hidden>${esc(p.name)} · ${esc(p.contact)}</div>
      </div>
    </article>`;
  }

  
  function bindCards(root) {
    root.querySelectorAll('.pr-btn').forEach((btn) => {
      btn.onclick = () => {
        btn.hidden = true;
        btn.parentNode.querySelector('.pr-ctv').hidden = false;
      };
    });
    root.querySelectorAll('.gallery').forEach((g) => {
      g.onscroll = () => {
        const i = Math.round(g.scrollLeft / g.clientWidth);
        const c = g.parentNode.querySelector('.g-count');
        if (c) c.textContent = `${i + 1}/${g.children.length}`;
      };
    });
    root.querySelectorAll('.g-btn').forEach((b) => {
      b.onclick = () => {
        const g = b.parentNode.querySelector('.gallery');
        g.scrollBy({ left: Number(b.dataset.dir) * g.clientWidth, behavior: 'smooth' });
      };
    });
  }

  function renderFeed() {
    const feed = $('prFeed');
    feed.setAttribute('aria-busy', String(phase === 'loading'));

    if (phase === 'loading') {
      $('prCount').textContent = '';
      feed.innerHTML = '<div class="pr-loading">กำลังโหลด…</div>';
      return;
    }
    if (phase === 'error') {
      $('prCount').textContent = '';
      feed.innerHTML = `<div class="pr-empty is-error">
                          <p>${esc(errorText)}</p>
                          <button type="button" class="btn" id="prRetry">ลองใหม่</button>
                        </div>`;
      $('prRetry').onclick = loadMine;
      return;
    }
    if (phase !== 'ready') {
      feed.innerHTML = '';
      return;
    }

    $('prCount').textContent = mine.length;
    if (!mine.length) {
      feed.innerHTML = `<div class="pr-empty">
                          <p>ยังไม่มีโพสต์ของคุณ</p>
                          <button type="button" class="btn" id="prAdd">＋ เพิ่มโพสต์</button>
                        </div>`;
      $('prAdd').onclick = () => $('navAdd').click();
      return;
    }
    feed.innerHTML = mine.map(cardHtml).join('');
    bindCards(feed);
  }

  
  $('navProfile').onclick = () => show('profile');

  document.addEventListener('viewchange', (e) => {
    $('navProfile').classList.toggle('active', e.detail === 'profile');
    
    document.body.classList.toggle('pr-page', e.detail === 'profile');
    if (e.detail === 'profile') document.body.classList.remove('plaid');
    seq += 1; 

    if (e.detail === 'profile') {
      renderHeader();
      loadMine();
    } else if (e.detail === 'login') {
      mine = [];
      renderHeader();
      renderFeed();
    }
  });
})();
