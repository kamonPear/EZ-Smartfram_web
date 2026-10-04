import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { FOOD_TYPE_SMALL, FOOD_TYPE_LARGE } from '../Food/Food';

interface CoopFoodConsumption {
  coop_id: number;
  name_coop: string;
  amount: number;
  age_weeks: number;
  food_type: string;
  estimated_kg_per_day: number;
}

interface FoodDistributionRow {
  distribution_id: number;
  food_type: string;
  coop_id: number;
  kg_given: number;
  distributed_at: string;
}

// หน้า "สรุปผลอาหารแต่ละประเภท" - ย้ายมาจากแอปมือถือ (Main_FoodTypeSummary) ดูอย่าง
// เดียว: เลือกประเภทอาหาร (เม็ดเล็ก/เม็ดใหญ่) แล้วดูว่าแต่ละคอกกินวันละกี่กิโล
// (ประมาณจากจำนวนไก่จริง) แตะคอกไหนดูประวัติการตัดสต็อกจริงของคอกนั้นได้ - การตัด
// สต็อกจริงทำที่หน้าคลังอาหาร (ปุ่ม "ตัดสต็อก") หรือ Cron อัตโนมัติทุกวันตอน 6 โมงเช้า
// ไม่มีโหมดกรอกจำนวนเองแล้ว (คำนวณให้อัตโนมัติทั้งหมด)
@Component({
  selector: 'app-food-type-summary',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './Food_type_summary.html',
  styleUrls: ['./Food_type_summary.scss']
})
export class FoodTypeSummaryComponent {
  readonly FOOD_TYPE_SMALL = FOOD_TYPE_SMALL;
  readonly FOOD_TYPE_LARGE = FOOD_TYPE_LARGE;

  isLoading = true;
  selectedFoodType: string = FOOD_TYPE_SMALL;

  coopConsumption: CoopFoodConsumption[] = [];
  distributionHistory: FoodDistributionRow[] = [];

  // ป็อบอัพประวัติของคอกที่กำลังดู
  historyCoopId: number | null = null;
  historyCoopName = '';

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {
    const type = this.route.snapshot.queryParamMap.get('type');
    if (type === FOOD_TYPE_SMALL || type === FOOD_TYPE_LARGE) {
      this.selectedFoodType = type;
    }

    this.loadData();
  }

  // รวมสองคำขอเป็น forkJoin เดียว (เดิมยิงแยกกันคนละ subscribe/detectChanges())
  // - ไม่ใช่แค่สวยกว่า แต่กันปัญหาจริงด้วย: ถ้า detectChanges() ของสองคำขอยิงประกบ
  // กันเร็วมาก (เช่นตอบกลับมาไล่เลี่ยกันตอนโหลดหน้าแรกสุด) หน้าจออาจค้างไม่รีเฟรช
  // จนกว่าจะมี event อื่น (เช่นกดคีย์บอร์ด) มาสะกิดให้ Angular เช็กใหม่อีกที -
  // รวมเป็นจุดเดียวที่ข้อมูลพร้อมครบแล้วค่อย detectChanges() ครั้งเดียวจบ ตัดโอกาส
  // ชนกันทิ้งไปเลย
  loadData() {
    this.isLoading = true;
    forkJoin({
      coopConsumption: this.api.get<CoopFoodConsumption[]>('/foods/coop-consumption'),
      distributionHistory: this.api.get<FoodDistributionRow[]>('/foods/distribution'),
    }).subscribe({
      next: ({ coopConsumption, distributionHistory }) => {
        this.coopConsumption = coopConsumption || [];
        this.distributionHistory = distributionHistory || [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('โหลดข้อมูลอาหารไม่สำเร็จ:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get coopsForSelectedType(): CoopFoodConsumption[] {
    return this.coopConsumption.filter(c => c.food_type === this.selectedFoodType);
  }

  // coopsForSelectedType เป็น getter (คืนอาร์เรย์ใหม่ทุกครั้งที่ถูกเรียก) - ต้องมี
  // trackBy ให้ *ngFor ยึดด้วย coop_id ไม่งั้น Angular เสี่ยงสร้าง DOM node ของแต่ละ
  // แถวใหม่ทุกรอบ CD (เจอบั๊กแบบนี้มาแล้วหลายหน้าในเว็บนี้)
  trackByCoopId(_index: number, coop: CoopFoodConsumption): number {
    return coop.coop_id;
  }

  coopCountForType(foodType: string): number {
    return this.coopConsumption.filter(c => c.food_type === foodType).length;
  }

  // ยอดกิโลล่าสุดที่ตัดจริงของคอกนี้+ประเภทนี้ (จากประวัติ ไม่ใช่ตัวเลขประมาณการ)
  // ประวัติเรียงใหม่สุดก่อนจาก backend อยู่แล้ว เจอค่าแรกคือค่าล่าสุดเสมอ
  actualKgFor(coopId: number, foodType: string): number | null {
    const row = this.distributionHistory.find(r => r.coop_id === coopId && r.food_type === foodType);
    return row ? row.kg_given : null;
  }

  selectFoodType(type: string) {
    this.selectedFoodType = type;
  }

  openHistory(coop: CoopFoodConsumption) {
    this.historyCoopId = coop.coop_id;
    this.historyCoopName = coop.name_coop;
    this.cdr.detectChanges();
  }

  closeHistory() {
    this.historyCoopId = null;
    this.cdr.detectChanges();
  }

  get historyRows(): FoodDistributionRow[] {
    if (this.historyCoopId == null) return [];
    return this.distributionHistory
      .filter(r => r.coop_id === this.historyCoopId && r.food_type === this.selectedFoodType)
      .sort((a, b) => new Date(b.distributed_at).getTime() - new Date(a.distributed_at).getTime());
  }

  formatDateSimple(iso: string | undefined | null): string {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
