import { render } from './components/feed.js';
import { setType } from './components/post-form.js';
import { openLightbox } from './components/lightbox.js';
import { openDetail } from './components/detail.js';
import { restoreSession } from './session.js';
// โหลดโมดูลที่ผูก event ของ component
import './components/navbar.js';
import './components/login.js';

document.addEventListener('click', (e) => {
  const zoom = e.target.closest('.dm-gallery img, .claim-imgs img');
  if (zoom) {
    const g = zoom.parentNode;
    const imgs = Array.from(g.children);
    openLightbox(imgs.map((el) => el.getAttribute('src')), imgs.indexOf(zoom), g);
    return;
  }

  if (e.target.closest('.g-btn')) return;
  const card = e.target.closest('.post');
  if (card) openDetail(Number(card.dataset.i));
});

render();
setType('lost');
restoreSession();
