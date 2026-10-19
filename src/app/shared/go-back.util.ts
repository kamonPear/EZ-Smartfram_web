import { inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';

// ปุ่ม "ยกเลิก" ของหน้าฟอร์ม - กลับไปหน้าที่เปิดมาก่อนหน้า (ไม่เด้งไปหน้าแรก) จะได้ทำงานต่อจากเดิม
//
// - เปิดหน้าตามปกติ: ถอยหน้าเบราว์เซอร์ 1 ครั้ง
// - เปิดตรงจากลิงก์/รีเฟรช (ไม่มีหน้าก่อนหน้าในเว็บนี้): ไปหน้า fallback แทน ไม่หลุดออกนอกเว็บ
// - ฝังอยู่ในป็อบอัพของหน้าข้อมูลคอก: Location ถูกแทนด้วยตัวที่ back() = ปิดป็อบอัพ
//   (ดู openDevicePopup ใน Data_coop.ts) จึงเรียก back() ได้เลย
//
// ต้องเรียกตอนสร้าง component (เช่น field: readonly goBack = backNavigator('/home');)
export function backNavigator(fallback: string): () => void {
  const location = inject(Location);
  const router = inject(Router);
  return () => {
    // Angular ใส่ navigationId ลง history state ทุกครั้งที่เปลี่ยนหน้า - 1 = หน้าแรกที่เปิดเข้ามา
    const navigationId = (window.history.state as { navigationId?: number } | null)?.navigationId ?? 1;
    if (!(location instanceof Location) || navigationId > 1) {
      location.back();
    } else {
      router.navigateByUrl(fallback);
    }
  };
}
