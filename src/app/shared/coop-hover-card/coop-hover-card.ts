import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Coop,
  latestHealth,
  latestEgg,
  latestVaccine,
  deviceSummary,
  formatThaiDate,
} from '../coop-summary.util';

/**
 * การ์ดสรุปข้อมูลคอกแบบละเอียด แสดงตอนเอาเมาส์ไปชี้ที่คอก (ใช้ร่วมกันทั้งหน้ารายการคอก
 * และหน้าจัดวางผังฟาร์ม) - รวมสุขภาพ/ไข่/วัคซีนล่าสุด + สถานะอุปกรณ์ ในที่เดียว
 * แทนที่จะโชว์แค่สถานะอุปกรณ์เหมือนเดิม
 */
@Component({
  selector: 'app-coop-hover-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './coop-hover-card.html',
  styleUrls: ['./coop-hover-card.scss'],
})
export class CoopHoverCard {
  @Input() coop!: Coop;

  get health() {
    return latestHealth(this.coop);
  }

  get egg() {
    return latestEgg(this.coop);
  }

  get vaccine() {
    return latestVaccine(this.coop);
  }

  get devices() {
    return deviceSummary(this.coop);
  }

  formatDate(iso: string | undefined | null): string {
    return formatThaiDate(iso);
  }
}
