import { $ } from '../utils.js';
import { show } from '../views.js';
import { setType } from './post-form.js';
import { tab } from './feed.js';

$('navHome').onclick = () => show('home');
$('navAdd').onclick = () => { $('toast').hidden = true; setType(tab); show('form'); };
