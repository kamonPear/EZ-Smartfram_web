// ข้อมูลติดต่อทีมงาน/แอดมิน - ใช้ร่วมกันที่หน้า login (ลืมรหัสผ่าน) และเมนูข้าง (ติดต่อเรา)
// แก้เบอร์ที่นี่ที่เดียว ทุกที่จะเปลี่ยนตาม
export interface ContactPhone {
  name: string;
  phone: string;
}

export const CONTACT_PHONES: ContactPhone[] = [
  { name: 'คุณแพร', phone: '062-457-3255' },
  { name: 'คุณออย', phone: '082-661-8867' },
];

// เบอร์สำหรับลิงก์ tel: (ตัดขีดออก)
export function telHref(phone: string): string {
  return 'tel:' + phone.replace(/[^0-9+]/g, '');
}
