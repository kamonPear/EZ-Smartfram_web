// ไอคอนอุปกรณ์ - บาง "ชนิด" อุปกรณ์ (เช่นหลอดไฟ) ไม่มีรูป PNG ที่ตรงกันเลยใน
// ชุด assets ปัจจุบัน (เห็นแค่ไอคอนแตกเมื่อพยายามโหลด) แอปมือถือแก้ปัญหานี้ด้วย
// การเลือกไอคอนจากชื่ออุปกรณ์เอง ไม่ได้พึ่งพา path รูปที่ backend ส่งมาเสมอไป -
// ทำแบบเดียวกันที่นี่ โดยคืนเป็น data: URI ของ SVG ใช้แทนที่ <img src> ตรงๆได้
// ทุกจุดที่มีอยู่ ไม่ต้องเปลี่ยนโครง template

const LIGHT_BULB_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23F5A623" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z"/></svg>`
)}`;

function hasNoMatchingAsset(name: string): boolean {
  const n = (name || '').toLowerCase();
  return n.includes('หลอดไฟ') || n.includes('ไฟ') || n.includes('bulb') || n.includes('light');
}

/** คืน src ของไอคอนอุปกรณ์ที่ใช้แทน <img src> ได้ตรงๆ - เลือกตามชื่ออุปกรณ์ก่อน
 *  ถ้าเป็นชนิดที่ไม่มีรูปจริงในระบบ (เช่นหลอดไฟ) แล้วค่อย fallback ไปตาม icon
 *  ที่ backend ส่งมา หรือ esp32.png เป็นค่าสุดท้าย */
export function deviceIconSrc(device: { name?: string; icon?: string } | null | undefined): string {
  if (device?.name && hasNoMatchingAsset(device.name)) {
    return LIGHT_BULB_SVG;
  }
  return device?.icon || 'assets/images/esp32.png';
}
