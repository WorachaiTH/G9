import { mountComponents } from './mountComponents.js';

// 1) โหลด HTML component เข้า DOM ก่อน  2) ค่อยโหลดโค้ดที่ผูก event กับ element
await mountComponents();
await import('./app.js');
