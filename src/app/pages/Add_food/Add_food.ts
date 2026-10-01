import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { DatePickerCalendar } from '../../shared/date-picker-calendar/date-picker-calendar';
import { formatDateKey } from '../../shared/calendar-markers.util';
import { FOOD_TYPE_SMALL, FOOD_TYPE_LARGE } from '../Food/Food';

type DateField = 'import' | 'expiry' | null;

export function foodTypeAgeHint(foodType: string | null): string {
  if (foodType === FOOD_TYPE_SMALL) return 'สำหรับไก่อายุ 0-14 สัปดาห์';
  if (foodType === FOOD_TYPE_LARGE) return 'สำหรับไก่อายุตั้งแต่ 14 สัปดาห์ขึ้นไป';
  return 'เลือกประเภทอาหารให้ตรงกับช่วงอายุไก่';
}

// หน้า "เพิ่มสต็อกอาหาร" - ย้ายมาจากแอปมือถือ (Main_DataAdd_Food1) บันทึกผ่าน
// POST /api/importfoods ตัวเดียวกับที่แอปมือถือใช้ (backend บวกเข้า foodstock ให้
// อัตโนมัติ) ข้อมูลจึงตรงกันทั้งเว็บและแอปเสมอ เพราะเป็น DB เดียวกัน
@Component({
  selector: 'app-add-food',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, DatePickerCalendar],
  templateUrl: './Add_food.html',
  styleUrls: ['./Add_food.scss']
})
export class AddFoodComponent {
  readonly FOOD_TYPE_SMALL = FOOD_TYPE_SMALL;
  readonly FOOD_TYPE_LARGE = FOOD_TYPE_LARGE;
  foodTypeAgeHint = foodTypeAgeHint;

  selectedFoodType: string | null = null;
  importDate: Date | null = new Date();
  amount: number | null = null;
  threshold: number | null = null;
  // คำนวณอัตโนมัติจากปริมาณ+ปริมาณใกล้หมด (เหมือนแอปมือถือ) แต่ยังแก้ไขเองได้
  // ผ่านปฏิทินเผื่อต้องการแก้ไขวันที่คำนวณอัตโนมัติ
  expiryDate: Date | null = null;

  activeField: DateField = null;
  isSaving = false;

  // อัตรากินจริงต่อวัน (กก.) ของแต่ละประเภทอาหาร รวมจากจำนวนไก่จริงในทุกคอกที่กำลัง
  // กินอาหารประเภทนั้นอยู่ (ไม่ใช่ค่าคงที่ตายตัวอีกต่อไป) ดึงจาก endpoint เดียวกับ
  // ที่หน้าคลังอาหารใช้โชว์ตัวเลขต่อคอก เพื่อให้วันที่ใกล้หมดที่กะให้ตรงกับยอดที่จะ
  // ถูกตัดจริงทุกคืน ถ้าคอกยังไม่มี/ยังไม่รู้อายุ จะได้ 0 แล้วใช้ค่าเผื่อไว้แทน (เคส
  // ฟาร์มเพิ่งเริ่มยังไม่มีคอกให้คำนวณจากของจริงได้)
  private dailyConsumptionByType: Record<string, number> = {};
  private readonly fallbackConsumePerDay: Record<string, number> = {
    [FOOD_TYPE_SMALL]: 20,
    [FOOD_TYPE_LARGE]: 30,
  };

  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  constructor(
    private router: Router,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {
    this.loadDailyConsumption();
  }

  private loadDailyConsumption() {
    this.api.get<{ food_type: string; estimated_kg_per_day: number }[]>('/foods/coop-consumption').subscribe({
      next: (rows) => {
        const totals: Record<string, number> = {};
        for (const row of rows || []) {
          if (!row.food_type) continue;
          totals[row.food_type] = (totals[row.food_type] || 0) + (row.estimated_kg_per_day || 0);
        }
        this.dailyConsumptionByType = totals;
        this.recalculateExpiryDate();
        this.cdr.detectChanges();
      },
      error: (err) => console.error('โหลดอัตราการกินอาหารไม่สำเร็จ:', err),
    });
  }

  selectFoodType(type: string) {
    this.selectedFoodType = type;
    this.recalculateExpiryDate();
  }

  private recalculateExpiryDate() {
    const amt = this.amount ?? 0;
    if (amt <= 0 || this.threshold == null || !this.selectedFoodType) {
      this.expiryDate = null;
      return;
    }
    const consumePerDay = this.dailyConsumptionByType[this.selectedFoodType]
      || this.fallbackConsumePerDay[this.selectedFoodType]
      || 20;
    let daysLeft = 0;
    if (amt > this.threshold) {
      daysLeft = Math.ceil((amt - this.threshold) / consumePerDay);
    }
    const start = this.importDate ?? new Date();
    const d = new Date(start);
    d.setDate(d.getDate() + daysLeft);
    this.expiryDate = d;
  }

  onAmountChange() {
    this.recalculateExpiryDate();
  }

  onThresholdChange() {
    this.recalculateExpiryDate();
  }

  selectDateField(field: 'import' | 'expiry') {
    this.activeField = field;
    this.cdr.detectChanges();
  }

  closeCalendar() {
    this.activeField = null;
    this.cdr.detectChanges();
  }

  get activeFieldDate(): Date | null {
    if (this.activeField === 'import') return this.importDate;
    if (this.activeField === 'expiry') return this.expiryDate;
    return null;
  }

  onDaySelected(day: Date) {
    if (this.activeField === 'import') {
      this.importDate = day;
      this.recalculateExpiryDate();
    } else if (this.activeField === 'expiry') {
      this.expiryDate = day;
    }
    this.activeField = null;
    this.cdr.detectChanges();
  }

  formatDate(date: Date | null): string {
    if (!date) return '';
    return date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  private flashToast(message: string, type: 'success' | 'error' = 'success') {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.showToast = false;
      this.cdr.detectChanges();
    }, 2500);
  }

  saveFoodData() {
    if (!this.selectedFoodType) {
      this.flashToast('กรุณาเลือกประเภทอาหาร', 'error');
      return;
    }
    if (!this.importDate) {
      this.flashToast('กรุณาเลือกวันที่นำอาหารเข้า', 'error');
      return;
    }
    if (this.amount == null || this.amount <= 0) {
      this.flashToast('กรุณากรอกปริมาณที่นำเข้าให้มากกว่า 0', 'error');
      return;
    }
    if (!this.expiryDate) {
      this.flashToast('กรุณาเลือกวันที่อาหารใกล้หมด', 'error');
      return;
    }

    this.isSaving = true;
    const payload = {
      food_type: this.selectedFoodType,
      // import_volume เป็น int ฝั่ง backend (models.CreateImportFoodRequest)
      import_volume: Math.round(this.amount),
      expiry_date: `${formatDateKey(this.expiryDate)}T00:00:00Z`,
    };

    this.api.post('/importfoods', payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.flashToast('เพิ่มข้อมูลคลังอาหารสำเร็จ!');
        this.router.navigate(['/food']);
      },
      error: (err) => {
        this.isSaving = false;
        console.error('บันทึกข้อมูลคลังอาหารไม่สำเร็จ:', err);
        this.flashToast('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error');
      }
    });
  }
}
