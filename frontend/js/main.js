import { mountComponents } from './mountComponents.js';

// โหลด HTML component เข้า DOM ก่อนแล้วโหลดโค้ดที่ผูก event กับ element
await mountComponents();
await import('./app.js');
