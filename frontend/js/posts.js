// ข้อมูลโพสต์
import { fullImageUrl } from './utils.js';
import { DELETE_AFTER_DAYS } from './config.js';

export const posts = [];

export function statusBadge(p) {
  if (p.status === 'pending') return '<span class="st pending">รอยืนยัน (Pending)</span>';
  if (p.status === 'granted') return '<span class="st granted">ส่งมอบแล้ว (Granted)</span>';
  return '';
}

export function purgeNote(p) {
  if (p.status !== 'granted') return '';
  if (!p.grantedAt) return `โพสต์ปิดแล้ว รอลบภายใน ${DELETE_AFTER_DAYS} วัน`;
  const left = Math.ceil((new Date(p.grantedAt).getTime() + DELETE_AFTER_DAYS * 86400000 - Date.now()) / 86400000);
  return left > 0 ? `โพสต์ปิดแล้ว จะถูกลบอัตโนมัติใน ${left} วัน` : 'โพสต์ปิดแล้ว รอการลบอัตโนมัติ';
}

export function mapPostStatus(v) {
  const x = String(v || '').toLowerCase();
  if (x === 'claimed' || x === 'pending') return 'pending';
  if (x === 'returned' || x === 'granted') return 'granted';
  return 'open';
}

export function normalizePost(post) {
  const isFound = String(post.type).toLowerCase() === 'found';
  const timeFrom = post.timeFrom ? String(post.timeFrom).slice(0, 5) : '';
  const timeTo = post.timeTo ? String(post.timeTo).slice(0, 5) : '';
  return {
    id: post.id,
    authorEmail: post.authorEmail || '',
    ownerFlag: [post.owner, post.isOwner, post.mine].find((v) => typeof v === 'boolean') ?? null,
    authorIds: [post.authorEmail, post.authorId, post.authorEmployeeId, post.employeeId]
      .filter(Boolean).map((v) => String(v).toLowerCase()),
    grantedAt: post.grantedAt || null,
    status: mapPostStatus(post.status),
    type: isFound ? 'found' : 'lost',
    images: (post.images || post.imageUrls || [])
      .map((im) => fullImageUrl(typeof im === 'string' ? im : im.imageUrl)),
    imageIds: (post.images || []).map((im) => (typeof im === 'string' ? null : (im.id ?? null))),
    icon: isFound ? 'wallet' : 'bag',
    desc: post.desc || post.description || post.title || '',
    place: post.place || post.location || '',
    name: post.name || post.contactName || post.authorEmail || '',
    contact: post.contact || post.contactInfo || '',
    timeRange: timeFrom && timeTo ? `${timeFrom}–${timeTo}` : '',
    time: post.createdAt
      ? new Date(post.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
      : '',
  };
}
