import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Coop,
  vaccineTypeCount,
  totalEggCount,
  deviceSummary,
  formatThaiDate,
  formatChickenAge,
} from '../coop-summary.util';

/**
 * การ์ดสรุปข้อมูลคอกแบบละเอียด แสดงตอนเอาเมาส์ไปชี้ที่คอก (ใช้ร่วมกันทั้งหน้ารายการคอก
 * และหน้าจัดวางผังฟาร์ม) - โชว์ภาพรวมของคอก (วันเกิดไก่/จำนวนวัคซีนที่ให้ไปกี่ชนิด/
 * จำนวนไข่สะสม/อุปกรณ์) แทนที่จะโชว์แค่ "รายการล่าสุด" ของแต่ละอย่างแบบเดิม
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

  get vaccineCount() {
    return vaccineTypeCount(this.coop);
  }

  get eggCount() {
    return totalEggCount(this.coop);
  }

  get devices() {
    return deviceSummary(this.coop);
  }

  formatDate(iso: string | undefined | null): string {
    return formatThaiDate(iso);
  }

  get age(): string {
    return formatChickenAge(this.coop.birthday);
  }
}
