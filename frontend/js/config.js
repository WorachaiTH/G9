// ค่าคงที่
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const EMPLOYEE_ID_PATTERN = /^\d+$/;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES = 5;
export const API_ORIGIN = 'http://localhost:8080';
export const API_BASE_URL = `${API_ORIGIN}/api`;
export const SESSION_EMAIL_KEY = 'lostAndFoundEmail';
export const SESSION_TOKEN_KEY = 'lostAndFoundToken';
export const SESSION_EMPLOYEE_ID_KEY = 'lostAndFoundEmployeeId';
export const MY_POSTS_KEY = 'lostAndFoundMyPosts';
export const SESSION_DISPLAY_NAME_KEY = 'lostAndFoundDisplayName';

export const ICONS = {
  wallet: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M16 12h5v3h-5a1.5 1.5 0 0 1 0-3z"/>',
  key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v4"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
};

export const DELETE_AFTER_DAYS = 30;
