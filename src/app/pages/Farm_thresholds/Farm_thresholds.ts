import { Component, ChangeDetectorRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FarmThresholdService } from '../../services/farm-threshold.service';

@Component({
  selector: 'app-farm-thresholds',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './Farm_thresholds.html',
  styleUrls: ['./Farm_thresholds.scss']
})
export class FarmThresholdsComponent {
  readonly tempMin = 10;
  readonly tempMax = 45;
  readonly ammoniaMin = 0;
  readonly ammoniaMax = 100;

  temp: number;
  ammonia: number;
  isLoading = true;

  showToast = false;
  toastMessage = '';
  isSaving = false;

  constructor(private router: Router, private thresholds: FarmThresholdService, private cdr: ChangeDetectorRef) {
    this.temp = this.thresholds.temperature();
    this.ammonia = this.thresholds.ammonia();

    // ค่าตอนนี้มาจาก backend แล้ว (ไม่ใช่ localStorage) โหลดเป็น async เลยต้องรอ
    // สัญญาณ isLoaded ก่อนค่อยซิงก์ค่าดราฟต์ของฟอร์มนี้ตาม แล้วยิง detectChanges()
    // เองเพราะแอปนี้ไม่มี zone.js
    effect(() => {
      if (this.thresholds.isLoaded()) {
        // ยังไม่เคยตั้งค่าเลยก็เป็น 0 ตรงๆ ตามที่ backend ส่งมา - ไม่สวมค่า default
        // ปลอมๆ ให้ดูเหมือนตั้งไว้แล้ว ผู้ใช้ปรับเองจาก 0 ขึ้นไปตามต้องการ
        this.temp = this.thresholds.temperature();
        this.ammonia = this.thresholds.ammonia();
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });

    this.thresholds.load();
  }

  adjustTemp(delta: number) {
    this.temp = Math.min(this.tempMax, Math.max(this.tempMin, this.temp + delta));
  }

  adjustAmmonia(delta: number) {
    this.ammonia = Math.min(this.ammoniaMax, Math.max(this.ammoniaMin, this.ammonia + delta));
  }

  save() {
    this.isSaving = true;
    // รอผลจาก backend จริงก่อน - สำเร็จค่อยโชว์ toast แล้วพากลับหน้าแรก (คล้ายกับ
    // Navigator.pop ของแอปมือถือ) ถ้าล้มเหลวอยู่หน้านี้ต่อและแจ้งผู้ใช้
    this.thresholds.save(this.temp, this.ammonia).subscribe({
      next: () => {
        this.toastMessage = 'บันทึกค่ามาตรฐานสำเร็จ';
        this.showToast = true;
        this.cdr.detectChanges();
        setTimeout(() => {
          this.router.navigate(['/home']);
        }, 700);
      },
      error: (err) => {
        console.error('บันทึกค่ามาตรฐานของฟาร์มไม่สำเร็จ:', err);
        this.isSaving = false;
        this.toastMessage = 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
        this.showToast = true;
        this.cdr.detectChanges();
        setTimeout(() => {
          this.showToast = false;
          this.cdr.detectChanges();
        }, 2500);
      }
    });
  }
}
