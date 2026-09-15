import { Component } from '@angular/core';
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

  showToast = false;
  isSaving = false;

  constructor(private router: Router, private thresholds: FarmThresholdService) {
    this.thresholds.load();
    this.temp = this.thresholds.temperature();
    this.ammonia = this.thresholds.ammonia();
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
