import { $, notify } from '../utils.js';

const ITEM_STORAGE_KEY = 'lf_items';
const LOCATION_STORAGE_KEY = 'lf_locations';

const DEFAULT_ITEMS = [
  'กระเป๋าสตางค์',
  'บัตรนักศึกษา',
  'ร่มพับ',
  'แฟลชไดรฟ์',
  'หูฟังไร้สาย',
  'พาวเวอร์แบงก์',
  'สายชาร์จ',
  'กล่องแว่นตา',
  'สมุดโน้ต',
  'เครื่องคิดเลข',
  'กุญแจรถ',
  'กระบอกน้ำ',
  'กล่องข้าว',
  'เสื้อคลุม',
  'ป้ายชื่อ',
  'บัตรจอดรถ',
  'เมาส์ไร้สาย',
  'ขาตั้งโทรศัพท์',
];

const PREVIOUS_DEFAULT_ITEMS = [
  'กระเป๋าตัง',
  'บัตรนักศึกษา',
  'แก้วน้ำ',
  'กระเป๋าดินสอ',
  'ตุ๊กตา',
  'โทรศัพท์มือถือ',
  'กุญแจ',
  'หูฟัง',
];

const DEFAULT_LOCATIONS = [
  'หอพักโซน B',
  'โรงอาหารกรีนแคนทีน',
  'sc1',
  'หอพักโซน A',
  'บร.1',
  'sc3',
  'หอพักโซน M',
  'บร.2',
  'เชียงราก1',
  'หอพักโซน F',
  'บร.3',
  'อาคารโดมบริหาร',
  'หอพักโซน C',
  'บร.4',
  'หอสมุดป๋วย',
  'โรงอาหารทิวสน',
  'บร.5',
  'ศกร.',
];

function uniqueValues(values) {
  const seen = new Set();
  return values.reduce((result, value) => {
    if (typeof value !== 'string') return result;
    const trimmed = value.trim();
    const key = trimmed.toLocaleLowerCase();
    if (!trimmed || seen.has(key)) return result;
    seen.add(key);
    result.push(trimmed);
    return result;
  }, []);
}

function loadOptions(key, defaults, deprecatedDefaults = []) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    const deprecated = new Set(deprecatedDefaults.map((value) => value.toLocaleLowerCase()));
    const custom = Array.isArray(saved)
      ? saved.filter((value) => typeof value === 'string' && !deprecated.has(value.trim().toLocaleLowerCase()))
      : [];
    return uniqueValues([...defaults, ...custom]);
  } catch (error) {
    console.error('Unable to load filter options:', error);
    return [...defaults];
  }
}

let itemOptions = loadOptions(ITEM_STORAGE_KEY, DEFAULT_ITEMS, PREVIOUS_DEFAULT_ITEMS);
let locationOptions = loadOptions(LOCATION_STORAGE_KEY, DEFAULT_LOCATIONS);
let selectedItem = '';
let selectedLocation = '';
let rerenderPosts = () => {};

function updateSummary() {
  const parts = [];
  if (selectedItem) parts.push(`สิ่งของ: ${selectedItem}`);
  if (selectedLocation) parts.push(`สถานที่: ${selectedLocation}`);
  $('filterSummary').textContent = parts.length
    ? `กำลังกรอง → ${parts.join(' | ')}`
    : 'ยังไม่ได้เลือกตัวกรอง';
}

function renderChips(containerId, values, selected, onSelect) {
  const container = $(containerId);
  container.replaceChildren();
  values.forEach((value) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `filter-chip${selected === value ? ' active' : ''}`;
    button.textContent = value;
    button.title = value;
    button.setAttribute('aria-pressed', String(selected === value));
    button.addEventListener('click', () => onSelect(selected === value ? '' : value));
    container.appendChild(button);
  });
}

function renderOptions() {
  renderChips('itemList', itemOptions, selectedItem, (value) => {
    selectedItem = value;
    updateSummary();
    rerenderPosts();
    renderOptions();
  });
  renderChips('locationList', locationOptions, selectedLocation, (value) => {
    selectedLocation = value;
    updateSummary();
    rerenderPosts();
    renderOptions();
  });
}

function addOption(inputId, key, getOptions, setOptions) {
  const input = $(inputId);
  const value = input.value.trim();
  if (!value) {
    input.focus();
    return;
  }

  const options = getOptions();
  const existing = options.find((option) => option.toLocaleLowerCase() === value.toLocaleLowerCase());
  if (existing) {
    input.value = '';
    if (key === ITEM_STORAGE_KEY) selectedItem = existing;
    else selectedLocation = existing;
    renderOptions();
    updateSummary();
    rerenderPosts();
    return;
  }

  const updated = [...options, value];
  try {
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (error) {
    console.error('Unable to save filter option:', error);
    notify('บันทึกตัวเลือกตัวกรองไม่ได้ กรุณาตรวจสอบการตั้งค่าเบราว์เซอร์');
    return;
  }
  setOptions(updated);
  if (key === ITEM_STORAGE_KEY) selectedItem = value;
  else selectedLocation = value;
  input.value = '';
  renderOptions();
  updateSummary();
  rerenderPosts();
}

export function initFilters(renderPosts) {
  rerenderPosts = renderPosts;
  renderOptions();
  updateSummary();

  $('toggleFilterBtn').addEventListener('click', () => {
    const panel = $('filterPanel');
    const expanded = $('toggleFilterBtn').getAttribute('aria-expanded') === 'true';
    panel.hidden = expanded;
    $('toggleFilterBtn').setAttribute('aria-expanded', String(!expanded));
    $('filterArrow').textContent = expanded ? '▼' : '▲';
  });

  $('addItemForm').addEventListener('submit', (event) => {
    event.preventDefault();
    addOption('newItemInput', ITEM_STORAGE_KEY, () => itemOptions, (values) => { itemOptions = values; });
  });
  $('addLocationForm').addEventListener('submit', (event) => {
    event.preventDefault();
    addOption('newLocationInput', LOCATION_STORAGE_KEY, () => locationOptions, (values) => { locationOptions = values; });
  });

  $('clearFilterBtn').addEventListener('click', () => {
    selectedItem = '';
    selectedLocation = '';
    renderOptions();
    updateSummary();
    rerenderPosts();
  });
  $('applyFilterBtn').addEventListener('click', rerenderPosts);
}

export function matchesFilters(post) {
  const itemText = String(post.desc || '').toLocaleLowerCase();
  const locationText = String(post.place || '').toLocaleLowerCase();
  return (!selectedItem || itemText.includes(selectedItem.toLocaleLowerCase())) &&
    (!selectedLocation || locationText.includes(selectedLocation.toLocaleLowerCase()));
}

export function hasActiveFilters() {
  return Boolean(selectedItem || selectedLocation);
}
