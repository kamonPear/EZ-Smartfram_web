import { Component, ChangeDetectorRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { DEFAULT_DRAFT_AMMONIA, DEFAULT_DRAFT_TEMP, FarmThresholdService } from '../../services/farm-threshold.service';

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
  isSaving = false;

  constructor(private router: Router, private thresholds: FarmThresholdService, private cdr: ChangeDetectorRef) {
    this.temp = this.thresholds.temperature();
    this.ammonia = this.thresholds.ammonia();

    // ค่าตอนนี้มาจาก backend แล้ว (ไม่ใช่ localStorage) โหลดเป็น async เลยต้องรอ
    // สัญญาณ isLoaded ก่อนค่อยซิงก์ค่าดราฟต์ของฟอร์มนี้ตาม แล้วยิง detectChanges()
    // เองเพราะแอปนี้ไม่มี zone.js
    effect(() => {
      if (this.thresholds.isLoaded()) {
        // ยังไม่เคยตั้งค่าเลย (ไม่ใช่ตั้งไว้เป็น 0 จริงๆ) - เริ่มฟอร์มที่ค่ากลางแนะนำ
        // แทนที่จะเป็น 0 ซึ่งอยู่นอกช่วงปกติและต้องกด "+" เองหลายสิบครั้ง
        if (this.thresholds.isConfigured()) {
          this.temp = this.thresholds.temperature();
          this.ammonia = this.thresholds.ammonia();
        } else {
          this.temp = DEFAULT_DRAFT_TEMP;
          this.ammonia = DEFAULT_DRAFT_AMMONIA;
        }
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
    this.thresholds.save(this.temp, this.ammonia);
    this.isSaving = true;
    this.showToast = true;
    // โชว์ toast สั้นๆก่อนพากลับไปหน้าแรก (คล้ายกับ Navigator.pop ของแอปมือถือ
    // หลังบันทึกค่ามาตรฐานสำเร็จ)
    setTimeout(() => {
      this.router.navigate(['/home']);
    }, 700);
  }
}
