import { Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';

// ค่ามาตรฐานอุณหภูมิ/แอมโมเนียของฟาร์ม - ใช้คู่กันกับหน้า Farm_thresholds
// ย้ายจาก localStorage มาเก็บที่ backend แล้ว (เดิมเว็บ/แอปมือถือต่างคนต่างเก็บใน
// เครื่องตัวเอง ปรับค่าฝั่งไหนก็ไม่ตรงกับอีกฝั่ง) ตอนนี้ทั้งสองแพลตฟอร์มอ่าน/เขียน
// แถวเดียวกันใน DB ผ่าน GET/PUT /api/farm-threshold แล้ว
const DEFAULT_TEMP = 25;
const DEFAULT_AMMONIA = 35;

interface FarmThresholdResponse {
  temperature: number;
  ammonia: number;
}

@Injectable({ providedIn: 'root' })
export class FarmThresholdService {
  temperature = signal(DEFAULT_TEMP);
  ammonia = signal(DEFAULT_AMMONIA);
  isLoaded = signal(false);

  constructor(private api: ApiService) {}

  load() {
    this.api.get<FarmThresholdResponse>('/farm-threshold').subscribe({
      next: (data) => {
        if (data?.temperature != null) this.temperature.set(data.temperature);
        if (data?.ammonia != null) this.ammonia.set(data.ammonia);
        this.isLoaded.set(true);
      },
      error: (err) => {
        console.error('โหลดค่ามาตรฐานของฟาร์มไม่สำเร็จ:', err);
        this.isLoaded.set(true);
      }
    });
  }

  save(temperature: number, ammonia: number) {
    this.temperature.set(temperature);
    this.ammonia.set(ammonia);
    this.api.put('/farm-threshold', { temperature, ammonia }).subscribe({
      error: (err) => console.error('บันทึกค่ามาตรฐานของฟาร์มไม่สำเร็จ:', err)
    });
  }
}
