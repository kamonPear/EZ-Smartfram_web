import { Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

// ค่ามาตรฐานอุณหภูมิ/แอมโมเนียของฟาร์ม - ใช้คู่กันกับหน้า Farm_thresholds
// ย้ายจาก localStorage มาเก็บที่ backend แล้ว (เดิมเว็บ/แอปมือถือต่างคนต่างเก็บใน
// เครื่องตัวเอง ปรับค่าฝั่งไหนก็ไม่ตรงกับอีกฝั่ง) ตอนนี้ทั้งสองแพลตฟอร์มอ่าน/เขียน
// แถวเดียวกันใน DB ผ่าน GET/PUT /api/farm-threshold แล้ว
//
// ผู้ใช้ที่ยังไม่เคยตั้งค่าเลย backend จะตอบ temperature/ammonia = 0 กับ id = 0
// (ไม่มีแถวจริงในฐานข้อมูล) ห้ามเอาไปแสดงตรงๆ หรือสลับไปใช้ค่า default ปลอมๆ แทน
// เพราะหน้าแรกจะโชว์เหมือนมีคนตั้งค่าไว้แล้วทั้งที่จริงยังไม่ได้ตั้ง - ใช้ isConfigured
// (id > 0) แยกสถานะ "ยังไม่ตั้งค่า" ออกจาก "ตั้งค่าไว้แล้วเป็น 0" ให้ชัดเจน

interface FarmThresholdResponse {
  id?: number;
  temperature: number;
  ammonia: number;
}

@Injectable({ providedIn: 'root' })
export class FarmThresholdService {
  temperature = signal(0);
  ammonia = signal(0);
  isConfigured = signal(false);
  isLoaded = signal(false);

  constructor(private api: ApiService, auth: AuthService) {
    // ออกจากระบบแล้วต้องล้างค่าของผู้ใช้เดิมทิ้ง - signal เหล่านี้อยู่ข้ามการเปลี่ยนหน้า
    // และ isLoaded ค้างเป็น true ถ้าไม่ล้าง หน้าแรกของผู้ใช้คนใหม่จะโชว์ค่าของคนก่อนหน้า
    // ทันทีที่เปิด จนกว่า load() จะตอบกลับมา
    auth.loggedOut$.subscribe(() => this.reset());
  }

  private reset() {
    this.temperature.set(0);
    this.ammonia.set(0);
    this.isConfigured.set(false);
    this.isLoaded.set(false);
  }

  load() {
    this.api.get<FarmThresholdResponse>('/farm-threshold').subscribe({
      next: (data) => {
        if (data?.temperature != null) this.temperature.set(data.temperature);
        if (data?.ammonia != null) this.ammonia.set(data.ammonia);
        this.isConfigured.set((data?.id ?? 0) > 0);
        this.isLoaded.set(true);
      },
      error: (err) => {
        console.error('โหลดค่ามาตรฐานของฟาร์มไม่สำเร็จ:', err);
        this.isLoaded.set(true);
      }
    });
  }

  // อัปเดต signal เฉพาะเมื่อ backend บันทึกสำเร็จ - ผู้เรียกต้อง subscribe เอง
  save(temperature: number, ammonia: number): Observable<unknown> {
    return this.api.put('/farm-threshold', { temperature, ammonia }).pipe(
      tap(() => {
        this.temperature.set(temperature);
        this.ammonia.set(ammonia);
        this.isConfigured.set(true);
      })
    );
  }
}
