import { Injectable, signal } from '@angular/core';

// ค่ามาตรฐานอุณหภูมิ/แอมโมเนียของฟาร์ม - ใช้คู่กันกับหน้า Farm_thresholds
// (ตอนนี้ยังเก็บแค่ในเบราว์เซอร์ผู้ใช้เอง ยังไม่ส่งขึ้น backend เหมือนแอปมือถือ
// เดิม - อนาคตถ้าจะทำระบบเปิด/ปิดพัดลม-ไฟอัตโนมัติจริงต้องย้ายไปเก็บที่ backend
// แทน เพราะต้องเทียบกับค่าเซนเซอร์แบบเรียลไทม์)
const TEMP_KEY = 'ez_target_temp';
const AMMONIA_KEY = 'ez_target_ammonia';
const DEFAULT_TEMP = 25;
const DEFAULT_AMMONIA = 35;

@Injectable({ providedIn: 'root' })
export class FarmThresholdService {
  temperature = signal(DEFAULT_TEMP);
  ammonia = signal(DEFAULT_AMMONIA);

  load() {
    try {
      const t = localStorage.getItem(TEMP_KEY);
      const a = localStorage.getItem(AMMONIA_KEY);
      if (t != null) this.temperature.set(Number(t));
      if (a != null) this.ammonia.set(Number(a));
    } catch {
      // localStorage อาจใช้ไม่ได้ (เช่น private mode) - ใช้ค่าเริ่มต้นแทน
    }
  }

  save(temperature: number, ammonia: number) {
    this.temperature.set(temperature);
    this.ammonia.set(ammonia);
    try {
      localStorage.setItem(TEMP_KEY, String(temperature));
      localStorage.setItem(AMMONIA_KEY, String(ammonia));
    } catch {
      // ไม่ต้องทำอะไรถ้าเซฟไม่ได้ - ค่ายังใช้ได้ในเซสชันนี้ แค่ไม่จำข้ามเซสชัน
    }
  }
}
