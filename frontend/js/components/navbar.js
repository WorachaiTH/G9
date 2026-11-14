import { $ } from '../utils.js';
import { show } from '../views.js';
import { setType } from './post-form.js';
import { loadPosts, tab } from './feed.js';

$('navHome').onclick = () => { loadPosts({ mine: false }); show('home'); };
$('navMine').onclick = () => { loadPosts({ mine: true }); show('home'); };
$('navAdd').onclick = () => { $('toast').hidden = true; setType(tab); show('form'); };
