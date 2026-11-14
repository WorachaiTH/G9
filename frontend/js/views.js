// สลับหน้า
import { $ } from './utils.js';

export function show(view) {
  $('login').hidden = view !== 'login'; $('home').hidden = view !== 'home';
  $('form').hidden = view !== 'form'; $('app-nav').hidden = view === 'login';

  if ($('navHome') && $('navAdd')) {
    const mine = $('navMine')?.getAttribute('aria-pressed') === 'true';
    $('navHome').classList.toggle('active', view === 'home' && !mine);
    $('navMine')?.classList.toggle('active', view === 'home' && mine);
    $('navAdd').classList.toggle('active', view === 'form');
  }

  document.body.classList.toggle('plaid', view !== 'login');
  window.scrollTo(0, 0);
}
