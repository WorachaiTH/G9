import { $ } from '../utils.js';
import { show } from '../views.js';
import { setType } from './post-form.js';
import { setTab, tab } from './feed.js';

$('navHome').onclick = () => show('home');
$('navAdd').onclick = () => {
  $('toast').hidden = true;
  setType(tab === 'found' ? 'found' : 'lost');
  show('form');
};

[['navViewAll', 'all'], ['navViewLost', 'lost'], ['navViewFound', 'found']].forEach(([id, view]) => {
  $(id).onclick = () => {
    setTab(view);
    show('home');
  };
});
