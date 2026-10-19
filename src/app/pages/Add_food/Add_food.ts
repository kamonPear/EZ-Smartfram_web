import { Component, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { DatePickerCalendar } from '../../shared/date-picker-calendar/date-picker-calendar';
import { formatDateKey } from '../../shared/calendar-markers.util';
import { FOOD_TYPE_SMALL, FOOD_TYPE_LARGE, FoodAgeRule } from '../Food/Food';
import { ConfirmService, thDate } from '../../services/confirm.service';
import { backNavigator } from '../../shared/go-back.util';

type DateField = 'import' | 'expiry' | null;

function ageRangeText(min: number, max: number): string {
  return max === 0 ? `ตั้งแต่ ${min} สัปดาห์ขึ้นไป` : `${min}-${max} สัปดาห์`;
}

// ข้อความใต้ปุ่มเลือกประเภทอาหาร: สรุปช่วงอายุของประเภทนั้นจากตารางที่เจ้าของฟาร์มกรอกไว้
export function foodTypeAgeHint(foodType: string | null, rules: FoodAgeRule[] = []): string {
  const mine = rules.filter(r => r.food_type === foodType).sort((a, b) => a.min_weeks - b.min_weeks);
  if (!foodType || mine.length === 0) {
    return 'ยังไม่ได้ตั้งช่วงอายุของประเภทนี้ (ตั้งได้ที่หน้าคลังอาหาร)';
  }
  return 'สำหรับไก่อายุ ' + mine.map(r => ageRangeText(r.min_weeks, r.max_weeks)).join(', ');
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
  private confirm = inject(ConfirmService);
  // ปุ่มยกเลิก: กลับหน้าก่อนหน้าที่เปิดมา ไม่เด้งไปหน้าแรก (shared/go-back.util.ts)
  readonly goBack = backNavigator('/food');
  readonly FOOD_TYPE_SMALL = FOOD_TYPE_SMALL;
  readonly FOOD_TYPE_LARGE = FOOD_TYPE_LARGE;
  ageRules: FoodAgeRule[] = [];
  ageHint(type: string | null): string {
    return foodTypeAgeHint(type, this.ageRules);
  }

  selectedFoodType: string | null = null;
  importDate: Date | null = new Date();
  amount: number | null = null;
  note = '';
  // ปริมาณ (กก.) ที่เจ้าของฟาร์มกำหนดให้แจ้งเตือน "ใกล้หมด" ของประเภทนี้ (ว่าง = ใช้ค่าเดิม)
  minQuantity: number | null = null;
  // คำนวณอัตโนมัติจากปริมาณที่นำเข้าและอัตรากินต่อวัน (ไม่มีช่องกรอกแล้ว)
  expiryDate: Date | null = null;

  activeField: DateField = null;
  isSaving = false;

  // อัตรากินจริงต่อวัน (กก.) ของแต่ละประเภทอาหาร รวมจากจำนวนไก่จริงในทุกคอกที่กำลัง
  // กินอาหารประเภทนั้นอยู่ (ไม่ใช่ค่าคงที่ตายตัวอีกต่อไป) ดึงจาก endpoint เดียวกับ
  // ที่หน้าคลังอาหารใช้โชว์ตัวเลขต่อคอก เพื่อให้วันที่ใกล้หมดที่กะให้ตรงกับยอดที่จะ
  // ถูกตัดจริงทุกวันตอน 6 โมงเช้า ถ้าคอกยังไม่มี/ยังไม่รู้อายุ จะได้ 0 แล้วใช้ค่าเผื่อไว้แทน (เคส
  // ฟาร์มเพิ่งเริ่มยังไม่มีคอกให้คำนวณจากของจริงได้)
  private dailyConsumptionByType: Record<string, number> = {};

  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  constructor(
    private router: Router,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {
    this.loadDailyConsumption();
    this.loadSavedThresholds();
    this.api.get<FoodAgeRule[]>('/food-age-rules').subscribe({
      next: (rules) => { this.ageRules = rules || []; this.cdr.detectChanges(); },
      error: (err) => console.error('โหลดเงื่อนไขอายุไม่สำเร็จ:', err),
    });
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

  // ปริมาณใกล้หมดที่เจ้าของเคยตั้งไว้ ใช้ค่าเดียวร่วมกันทุกประเภทอาหาร เติมในช่องให้
  // อัตโนมัติตั้งแต่เปิดหน้า จะได้ไม่ต้องกรอกซ้ำ (แก้ทับได้ และจะใช้กับทั้งสองประเภท)
  // ตั้งได้ครั้งเดียว: ถ้าเคยตั้งแล้ว (minLocked) จะล็อกช่องนี้ แก้ไขไม่ได้ (backend ก็ปฏิเสธการแก้)
  minLocked = false;
  showMinConfirm = false;

  private loadSavedThresholds() {
    this.api.get<{ min_quantity?: number }[]>('/foods').subscribe({
      next: (rows) => {
        const saved = (rows || []).map(r => Number(r.min_quantity) || 0).find(v => v > 0);
        if (saved != null) {
          this.minQuantity = saved;
          this.minLocked = true;
        }
        this.cdr.detectChanges();
      },
      error: (err) => console.error('โหลดปริมาณใกล้หมดที่เคยตั้งไม่สำเร็จ:', err),
    });
  }

  selectFoodType(type: string) {
    this.selectedFoodType = type;
    this.recalculateExpiryDate();
  }

  private recalculateExpiryDate() {
    const amt = this.amount ?? 0;
    if (amt <= 0 || !this.selectedFoodType) {
      this.expiryDate = null;
      return;
    }
    // อัตรากินต่อวันมาจากเงื่อนไขที่เจ้าของฟาร์มตั้งไว้ (ไม่มีค่าตายตัวในโค้ด) ถ้ายังไม่มี
    // คอกที่กินอาหารประเภทนี้ หรือยังไม่ได้ตั้งเงื่อนไข จะประมาณวันไม่ได้ ใช้วันที่นำเข้าแทน
    const consumePerDay = this.dailyConsumptionByType[this.selectedFoodType] || 0;
    const daysLeft = consumePerDay > 0 ? Math.ceil(amt / consumePerDay) : 0;
    const start = this.importDate ?? new Date();
    const d = new Date(start);
    d.setDate(d.getDate() + daysLeft);
    this.expiryDate = d;
  }

  onAmountChange() {
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

  cancelMinConfirm() {
    this.showMinConfirm = false;
    this.cdr.detectChanges();
  }

  async saveFoodData() {
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
      this.flashToast('กรุณาเลือกประเภทอาหารและปริมาณที่นำเข้า', 'error');
      return;
    }

    if (!this.minLocked && this.minQuantity != null && this.minQuantity < 0) {
      this.flashToast('ปริมาณแจ้งเตือนต้องไม่ติดลบ', 'error');
      return;
    }

    // กรอกปริมาณใกล้หมดเป็นครั้งแรก -> ถามยืนยันก่อน เพราะบันทึกแล้วแก้ไขไม่ได้
    if (!this.minLocked && this.minQuantity != null && this.minQuantity > 0 && !this.showMinConfirm) {
      this.showMinConfirm = true;
      this.cdr.detectChanges();
      return;
    }
    // กดยืนยันจากป็อบอัพ "ตั้งปริมาณใกล้หมด" มาแล้ว ถือว่ายืนยันแล้ว ไม่ถามซ้ำอีกรอบ
    const confirmedViaMinDialog = this.showMinConfirm;
    this.showMinConfirm = false;

    if (!confirmedViaMinDialog) {
      // ให้เจ้าของฟาร์มทวนข้อมูลอีกรอบก่อนบันทึกจริง (ป็อบอัพกลาง services/confirm.service.ts)
      const ok = await this.confirm.ask({
        message: 'ตรวจสอบข้อมูลการนำเข้าอาหารก่อนบันทึก',
        details: [`ประเภทอาหาร: ${this.selectedFoodType}`, `ปริมาณ: ${Math.round(this.amount!)} กก.`, `วันที่นำเข้า: ${thDate(this.importDate)}`, `วันที่อาหารจะหมด: ${thDate(this.expiryDate)}`, ...(this.note.trim() ? [`หมายเหตุ: ${this.note.trim()}`] : [])],
      });
      if (!ok) return;
    }

    this.isSaving = true;
    const payload: Record<string, unknown> = {
      food_type: this.selectedFoodType,
      // import_volume เป็น int ฝั่ง backend (models.CreateImportFoodRequest)
      import_volume: Math.round(this.amount),
      expiry_date: `${formatDateKey(this.expiryDate)}T00:00:00Z`,
      note: this.note.trim(),
    };
    // ตั้งครั้งแรกเท่านั้น (ถ้าล็อกแล้วไม่ส่ง) และต้องมากกว่า 0
    if (!this.minLocked && this.minQuantity != null && Number(this.minQuantity) > 0) {
      payload['min_quantity'] = Number(this.minQuantity);
    }

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
