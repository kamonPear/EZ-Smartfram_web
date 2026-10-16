import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { SiteSearchComponent } from '../../components/site-search/site-search.component';

// ประเภทอาหารที่รองรับ - ผูกกับช่วงอายุไก่ที่กินอาหารประเภทนั้น (ตรงกับฝั่ง backend
// models.FoodTypeSmallPellet/FoodTypeLargePellet เป๊ะ)
export const FOOD_TYPE_SMALL = 'เม็ดเล็ก';
export const FOOD_TYPE_LARGE = 'เม็ดใหญ่';

interface FoodStock {
  food_id: number;
  food_type: string;
  quantity_current: number;
  date_up: string;
}

interface CoopFoodConsumption {
  coop_id: number;
  name_coop: string;
  amount: number;
  age_weeks: number;
  food_type: string;
  estimated_kg_per_day: number;
}

// หนึ่งแถวในตารางการให้อาหารที่เจ้าของฟาร์มกรอกเอง: ไก่อายุ [min, max) สัปดาห์ กินอาหาร
// ประเภทนี้ ตัวละกี่กรัมต่อวัน (max = 0 คือไม่จำกัด) เก็บใน DB ตาราง food_age_rule
export interface FoodAgeRule {
  food_type: string;
  min_weeks: number;
  max_weeks: number;
  grams_per_bird: number;
}

// แถวในฟอร์ม - ช่องตัวเลขเริ่มว่างเปล่า (null) ให้กรอกเอง
interface AgeRuleRow {
  food_type: string;
  min_weeks: number | null;
  max_weeks: number | null;
  grams_per_bird: number | null;
}

interface HistoryEntry {
  kind: 'import' | 'distribute';
  foodType: string;
  amount: number;
  date: Date;
}

// หน้า "คลังอาหาร" - ย้ายมาจากแอปมือถือ (Main_DataFood_ShowDataFood1) ให้ตรงกัน
// ทั้งเว็บและแอป เพราะข้อมูลมาจาก backend ชุดเดียวกัน (DB เดียวกัน) อยู่แล้ว
@Component({
  selector: 'app-food',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, SiteSearchComponent],
  templateUrl: './Food.html',
  styleUrls: ['./Food.scss']
})
export class FoodComponent {
  readonly FOOD_TYPE_SMALL = FOOD_TYPE_SMALL;
  readonly FOOD_TYPE_LARGE = FOOD_TYPE_LARGE;

  isLoading = true;

  smallStock: FoodStock | null = null;
  largeStock: FoodStock | null = null;

  importHistory: HistoryEntry[] = [];
  distributeHistory: HistoryEntry[] = [];

  coopConsumption: CoopFoodConsumption[] = [];

  // ประเภทที่เลือกไว้ก่อนกดตัดสต็อก (ต้องเลือกก่อนเสมอ เหมือนแอปมือถือ)
  selectedDeductType: string | null = null;

  // เงื่อนไขช่วงอายุไก่ -> ประเภทอาหาร ที่เจ้าของฟาร์มตั้งเอง (max = 0 คือไม่จำกัด)
  showAgeConfig = false;
  isSavingAgeConfig = false;
  ageConfigError = '';
  ageRules: AgeRuleRow[] = [];

  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {
    this.loadAll();
  }

  // รวมทั้ง 4 คำขอ (สต็อก/ประวัตินำเข้า/ประวัติแจกจ่าย/การกินอาหารรายคอก) เป็น
  // forkJoin เดียว แทนที่จะยิงแยกกันคนละ subscribe/detectChanges() เหมือนเดิม -
  // เดิมเคยเจอบั๊กจริง (หน้า Food_type_summary) ที่ detectChanges() ของหลายคำขอ
  // ยิงไล่เลี่ยกันตอนโหลดหน้าแรกสุดแล้วจอค้างไม่รีเฟรชจนกว่าจะมี event อื่นมาสะกิด
  // (เช่นกดคีย์บอร์ด) - รวมเป็นจุดเดียวที่ข้อมูลพร้อมครบแล้วค่อย detectChanges()
  // ครั้งเดียวจบ ตัดโอกาสชนกันทิ้งไปเลย
  loadAll() {
    this.isLoading = true;
    forkJoin({
      foodstocks: this.api.get<FoodStock[]>('/foods'),
      imports: this.api.get<any[]>('/food_history'),
      distributions: this.api.get<any[]>('/foods/distribution'),
      coopConsumption: this.api.get<CoopFoodConsumption[]>('/foods/coop-consumption'),
    }).subscribe({
      next: ({ foodstocks, imports, distributions, coopConsumption }) => {
        this.smallStock = (foodstocks || []).find(r => r.food_type === FOOD_TYPE_SMALL) || null;
        this.largeStock = (foodstocks || []).find(r => r.food_type === FOOD_TYPE_LARGE) || null;

        const importEntries: HistoryEntry[] = (imports || [])
          .map((row): HistoryEntry | null => {
            const date = new Date(row.import_date);
            if (isNaN(date.getTime())) return null;
            return {
              kind: 'import',
              foodType: row.food_type || '-',
              amount: Number(row.import_volume) || 0,
              date,
            };
          })
          .filter((e): e is HistoryEntry => e !== null)
          .sort((a, b) => b.date.getTime() - a.date.getTime());

        // การแจกจ่าย: นับระดับวัน (ไม่สนเวลา/คอกไหน) รวมเป็นแถวเดียวต่อวันต่อ
        // ประเภท เหมือนแอปมือถือ ไม่งั้นดูเหมือนมีรายการซ้ำวันที่เพียบ
        const grouped = new Map<string, HistoryEntry>();
        for (const row of distributions || []) {
          const date = new Date(row.distributed_at);
          if (isNaN(date.getTime())) continue;
          const foodType = row.food_type || '-';
          const dayKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
          const key = `${foodType}_${dayKey}`;
          const kg = Number(row.kg_given) || 0;
          const existing = grouped.get(key);
          if (existing) {
            existing.amount += kg;
            if (date.getTime() > existing.date.getTime()) existing.date = date;
          } else {
            grouped.set(key, { kind: 'distribute', foodType, amount: kg, date });
          }
        }
        this.importHistory = importEntries;
        this.distributeHistory = Array.from(grouped.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
        this.coopConsumption = coopConsumption || [];

        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('โหลดข้อมูลคลังอาหารไม่สำเร็จ:', err);
        this.smallStock = null;
        this.largeStock = null;
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  coopCountForType(foodType: string): number {
    return this.coopConsumption.filter(c => c.food_type === foodType).length;
  }

  isStockEmpty(stock: FoodStock | null): boolean {
    return !stock || stock.quantity_current <= 0;
  }

  // สต็อกของประเภทที่เลือกไว้ (ก่อนกดตัดสต็อก) ว่างเปล่าอยู่แล้วหรือไม่ - ใช้ปิด
  // ปุ่ม "ตัดสต็อก" กันกดตัดของที่ไม่มีอยู่แล้ว (backend เองก็กันไม่ให้ติดลบอยู่
  // แล้ว แต่ปล่อยให้กดได้จะดูเหมือนตัดสำเร็จทั้งที่จริงๆ ไม่มีอะไรถูกตัดเลย)
  get isSelectedStockEmpty(): boolean {
    if (this.selectedDeductType === FOOD_TYPE_SMALL) return this.isStockEmpty(this.smallStock);
    if (this.selectedDeductType === FOOD_TYPE_LARGE) return this.isStockEmpty(this.largeStock);
    return false;
  }

  formatAmount(value: number | undefined | null): string {
    if (value == null) return '0';
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }

  formatDateSimple(iso: string | undefined | null): string {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  formatDateTime(iso: string | undefined | null): string {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    const date = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${date} เวลา ${time} น.`;
  }

  selectDeductType(foodType: string) {
    this.selectedDeductType = foodType;
  }

  // กดตัดสต็อก - ต้องเลือกประเภทก่อนเสมอ ยอดที่ตัดคำนวณอัตโนมัติจากจำนวนไก่จริง
  // ในคอกที่กำลังกินอาหารประเภทนี้อยู่ (handlers.ComputeDailyFoodConsumption ฝั่ง
  // backend ตัวเดียวกับที่ Cron ใช้ตัดให้ทุกวันตอน 6 โมงเช้า) ไม่ต้องกรอกจำนวนเองทีละคอกอีก
  // ต่อไป - กดปุ่มเดียวจบ
  isDeducting = false;

  forceDeductStock() {
    if (!this.selectedDeductType) {
      this.flashToast('กรุณาเลือกประเภทอาหารก่อนตัดสต็อก', 'error');
      return;
    }
    if (this.isSelectedStockEmpty) {
      this.flashToast(`สต็อกอาหาร${this.selectedDeductType}หมดแล้ว ไม่มีอะไรให้ตัด`, 'error');
      return;
    }
    this.isDeducting = true;
    this.api.post<{ message: string; deducted: number; shortfall?: number }>('/foodstocks/force-deduct', {
      food_type: this.selectedDeductType
    }).subscribe({
      next: (res) => {
        this.isDeducting = false;
        // backend ตอบ 200 เสมอแม้ตัดไม่สำเร็จเพราะสต็อกไม่พอ (shortfall > 0) -
        // ต้องเช็คฟิลด์นี้เอง ไม่งั้น toast จะขึ้นเขียวทั้งที่จริงๆ ไม่ได้ตัดอะไรเลย
        this.flashToast(res.message, (res.shortfall ?? 0) > 0 ? 'error' : 'success');
        this.selectedDeductType = null;
        this.loadAll();
      },
      error: (err) => {
        this.isDeducting = false;
        console.error('ตัดสต็อกไม่สำเร็จ:', err);
        this.flashToast('ตัดสต็อกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error');
      }
    });
  }

  private blankAgeRule(): AgeRuleRow {
    return { food_type: FOOD_TYPE_SMALL, min_weeks: null, max_weeks: null, grams_per_bird: null };
  }

  addAgeRule() {
    this.ageRules.push(this.blankAgeRule());
    this.ageConfigError = '';
  }

  removeAgeRule(index: number) {
    this.ageRules.splice(index, 1);
    this.ageConfigError = '';
  }

  openAgeConfig() {
    this.ageConfigError = '';
    this.api.get<FoodAgeRule[]>('/food-age-rules').subscribe({
      next: (rules) => {
        // ยังไม่เคยกรอก -> เริ่มด้วยแถวว่าง 1 แถว (ไม่เติมค่าให้)
        this.ageRules = (rules || []).map(r => ({
          food_type: r.food_type,
          min_weeks: r.min_weeks,
          max_weeks: r.max_weeks,
          grams_per_bird: r.grams_per_bird,
        }));
        if (this.ageRules.length === 0) this.ageRules.push(this.blankAgeRule());
        this.showAgeConfig = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('โหลดเงื่อนไขอายุไม่สำเร็จ:', err);
        this.flashToast('โหลดเงื่อนไขไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error');
      }
    });
  }

  closeAgeConfig() {
    this.showAgeConfig = false;
    this.cdr.detectChanges();
  }

  saveAgeConfig() {
    if (this.ageRules.length === 0) {
      this.ageConfigError = 'กรุณาเพิ่มช่วงอายุอย่างน้อย 1 แถว';
      return;
    }
    const rules: FoodAgeRule[] = [];
    for (let i = 0; i < this.ageRules.length; i++) {
      const row = this.ageRules[i];
      const n = i + 1;
      const vals = [row.min_weeks, row.max_weeks, row.grams_per_bird];
      if (vals.some(v => v === null || v === undefined || (v as unknown) === '')) {
        this.ageConfigError = `แถวที่ ${n}: กรุณากรอกให้ครบทุกช่อง`;
        return;
      }
      const min = Number(row.min_weeks), max = Number(row.max_weeks), grams = Number(row.grams_per_bird);
      if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < 0) {
        this.ageConfigError = `แถวที่ ${n}: อายุต้องเป็นจำนวนเต็ม (สัปดาห์) ที่ไม่ติดลบ`;
        return;
      }
      if (max !== 0 && max <= min) {
        this.ageConfigError = `แถวที่ ${n}: อายุสิ้นสุดต้องมากกว่าอายุเริ่มต้น (หรือใส่ 0 = ไม่จำกัด)`;
        return;
      }
      if (!(grams > 0)) {
        this.ageConfigError = `แถวที่ ${n}: ปริมาณอาหารต่อตัวต่อวัน (กรัม) ต้องมากกว่า 0`;
        return;
      }
      rules.push({ food_type: row.food_type, min_weeks: min, max_weeks: max, grams_per_bird: grams });
    }
    const sorted = [...rules].sort((a, b) => a.min_weeks - b.min_weeks);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i - 1].max_weeks === 0 || sorted[i - 1].max_weeks > sorted[i].min_weeks) {
        this.ageConfigError = 'ช่วงอายุของแต่ละแถวต้องไม่ซ้อนทับกัน';
        return;
      }
    }

    this.ageConfigError = '';
    this.isSavingAgeConfig = true;
    this.api.put<FoodAgeRule[]>('/food-age-rules', { rules }).subscribe({
      next: () => {
        this.isSavingAgeConfig = false;
        this.showAgeConfig = false;
        this.flashToast('บันทึกเงื่อนไขอายุไก่กับประเภทอาหารแล้ว');
        this.loadAll();
      },
      error: (err) => {
        this.isSavingAgeConfig = false;
        console.error('บันทึกเงื่อนไขอายุไม่สำเร็จ:', err);
        this.ageConfigError = (typeof err?.error === 'string' && err.error) || 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
        this.cdr.detectChanges();
      }
    });
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
}
