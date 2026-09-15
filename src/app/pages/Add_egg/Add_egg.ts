import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { DatePickerCalendar } from '../../shared/date-picker-calendar/date-picker-calendar';
import { DayMarker, loadCalendarMarkers, formatDateKey } from '../../shared/calendar-markers.util';
import { EggRecord, formatThaiDate } from '../../shared/coop-summary.util';

type ChartMode = 'day' | 'month' | 'year';

interface ChartBar {
  key: string;
  label: string;
  value: number;
  isCurrent: boolean;
  // จุดเริ่มต้นของช่วงที่แท่งนี้เป็นตัวแทน (เที่ยงคืนของวัน / วันที่ 1 ของเดือน /
  // 1 ม.ค. ของปี) ใช้หาข้อมูลดิบของช่วงนั้นตอนคลิก/ชี้เมาส์ดูรายละเอียด
  bucketStart: Date;
}

interface CoopEggTotal {
  name: string;
  total: number;
}

const THAI_MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

@Component({
  selector: 'app-add-egg',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, DatePickerCalendar],
  templateUrl: './Add_egg.html',
  styleUrls: ['./Add_egg.scss']
})
export class AddEggComponent {

  collectDate: Date | null = new Date();
  isCalendarOpen: boolean = false;
  dayMarkers: Map<string, DayMarker> | null = null;

  coops: any[] = [];

  // คอกของฟอร์ม "เพิ่มไข่" - ใช้บันทึกข้อมูลเข้าคอกไหน
  coopId: number | null = null;
  eggCount: number | null = null;
  note: string = '';
  isCoopDropdownOpen: boolean = false;

  // คอกของ "แผงสรุปผล" - แยกออกจากคอกของฟอร์มเพิ่มไข่โดยเจตนา ผู้ใช้อยากดูสรุป
  // ของคอกใดคอกหนึ่ง หรือดูรวมทุกคอกพร้อมกันได้ โดยไม่ต้องผูกกับคอกที่กำลังจะ
  // กรอกไข่เข้าไป (null = ดูรวมทุกคอก)
  statsCoopId: number | null = null;
  isStatsCoopDropdownOpen: boolean = false;

  // เปิดมาจากหน้า "ข้อมูลคอกไก่" ด้วย coop_id ที่ระบุมาแน่นอนแล้ว - ล็อกคอกทั้ง
  // ฟอร์มเพิ่มไข่และแผงสรุปผลไว้ ไม่ต้องให้เลือกคอกซ้ำอีกรอบ
  isCoopLocked = false;

  eggRecords: EggRecord[] = [];
  isLoadingHistory = false;
  chartMode: ChartMode = 'day';

  // คลิกแท่งกราฟเพื่อดูรายละเอียดของช่วงนั้น (วัน/เดือน/ปี) และเมาส์ชี้เพื่อดู
  // ยอดแยกตามคอกแบบป็อบอัพเล็กๆ - เก็บแค่ "key" ของแท่งไว้ ไม่เก็บ object ตรงๆ
  // เพราะ chartBars เป็น getter สร้างใหม่ทุกครั้ง อ้างอิงด้วย key เทียบง่ายกว่า
  selectedBarKey: string | null = null;
  hoveredBarKey: string | null = null;

  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  isSaving = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {
    // เปิดมาจากหน้า "ข้อมูลคอกไก่" ได้ด้วย - รับ coop_id มาพรีเซ็ตทั้งฟอร์มเพิ่มไข่
    // และแผงสรุปผลให้ตรงกับคอกที่ตั้งใจมาเลย
    const coopIdParam = Number(this.route.snapshot.queryParamMap.get('coop_id'));
    if (!isNaN(coopIdParam) && coopIdParam > 0) {
      this.coopId = coopIdParam;
      this.statsCoopId = coopIdParam;
      this.isCoopLocked = true;
    }

    this.loadCoops();
    this.loadMarkers();
    this.loadEggHistory();
  }

  get selectedCoopName(): string {
    const coop = this.coops.find(c => c.coop_id === this.coopId);
    return coop ? coop.name_coop : '';
  }

  get selectedStatsCoopName(): string {
    if (this.statsCoopId == null) return 'ทุกคอก';
    const coop = this.coops.find(c => c.coop_id === this.statsCoopId);
    return coop ? coop.name_coop : 'ทุกคอก';
  }

  toggleCoopDropdown() {
    if (this.isCoopLocked) return;
    this.isStatsCoopDropdownOpen = false;
    this.isCoopDropdownOpen = !this.isCoopDropdownOpen;
  }

  toggleStatsCoopDropdown() {
    if (this.isCoopLocked) return;
    this.isCoopDropdownOpen = false;
    this.isStatsCoopDropdownOpen = !this.isStatsCoopDropdownOpen;
  }

  selectCoop(coop: any) {
    this.coopId = coop.coop_id;
    this.isCoopDropdownOpen = false;
    this.loadMarkers();
  }

  selectStatsCoop(coop: any | null) {
    this.statsCoopId = coop ? coop.coop_id : null;
    this.isStatsCoopDropdownOpen = false;
    this.selectedBarKey = null;
    this.loadEggHistory();
  }

  closeDropdowns() {
    this.isCoopDropdownOpen = false;
    this.isStatsCoopDropdownOpen = false;
  }

  setChartMode(mode: ChartMode) {
    this.chartMode = mode;
    // เปลี่ยนโหมดแล้ว key ของแท่งที่เคยเลือกไว้ไม่มีอยู่ในชุดใหม่ ต้องล้างทิ้ง
    this.selectedBarKey = null;
  }

  selectBar(bar: ChartBar) {
    this.selectedBarKey = this.selectedBarKey === bar.key ? null : bar.key;
  }

  // เดิม mouseenter/mouseleave ผูก hoveredBarKey ตรงๆ ในเทมเพลต แล้วป็อบอัพไม่
  // หายตอนเอาเมาส์ออก - แอปนี้ไม่มี zone.js เลย เหตุการณ์เมาส์เร็วๆแบบนี้บาง
  // ครั้ง Angular ไม่รู้ตัวว่าต้อง re-render จึงต้องยิง detectChanges() เองตรงๆ
  // ในทุกจุดที่เปลี่ยนสถานะป็อบอัพ ไม่พึ่งการ re-render อัตโนมัติ
  onBarHoverStart(bar: ChartBar) {
    this.hoveredBarKey = bar.key;
    this.cdr.detectChanges();
  }

  onBarHoverEnd() {
    this.hoveredBarKey = null;
    this.cdr.detectChanges();
  }

  // chartBars เป็น getter ที่สร้าง array/object ใหม่ทุกครั้งที่ถูกเรียก (ทุกรอบ
  // change detection) - ถ้าไม่มี trackBy, *ngFor จะเห็นว่า "ของใหม่ทั้งหมด" ทุก
  // รอบแล้วทำลาย+สร้าง DOM ของแท่งกราฟใหม่หมดทุกครั้ง ทำให้ browser เสีย native
  // hover state ของ element เดิมไปกลางทาง (mouseleave ของปุ่มเก่าไม่มีผลกับปุ่ม
  // ใหม่ที่ถูกสร้างแทนที่) นี่คือสาเหตุจริงที่ป็อบอัพติดค้างไม่หายตอนเอาเมาส์ออก
  trackByBarKey(_index: number, bar: ChartBar): string {
    return bar.key;
  }

  loadCoops() {
    this.api.get<any[]>(`/coops`).subscribe({
      next: (coops: any[]) => {
        this.coops = coops;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('โหลดรายชื่อคอกไม่สำเร็จ:', err);
        this.cdr.detectChanges();
      }
    });
  }

  loadMarkers() {
    // มาร์คปฏิทินของฟอร์มเพิ่มไข่ ผูกกับคอกของฟอร์ม (coopId) เท่านั้น ไม่เกี่ยวกับ
    // คอกที่เลือกดูในแผงสรุปผล
    loadCalendarMarkers(this.api, this.coopId).subscribe({
      next: (markers) => {
        this.dayMarkers = markers;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('โหลดข้อมูลมาร์คปฏิทินไม่สำเร็จ:', err);
        this.cdr.detectChanges();
      }
    });
  }

  // ดึงประวัติไข่สำหรับแผงสรุปผล: ทั้งฟาร์ม (/eggs) หรือของคอกเดียว (/eggs?coop_id=)
  // แล้วแต่ statsCoopId - แยกอิสระจากคอกของฟอร์มเพิ่มไข่โดยตั้งใจ
  loadEggHistory() {
    this.isLoadingHistory = true;
    const endpoint = this.statsCoopId != null ? `/eggs?coop_id=${this.statsCoopId}` : `/eggs`;
    this.api.get<EggRecord[]>(endpoint).subscribe({
      next: (data) => {
        this.eggRecords = data || [];
        this.isLoadingHistory = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('โหลดประวัติไข่ไก่ไม่สำเร็จ:', err);
        this.eggRecords = [];
        this.isLoadingHistory = false;
        this.cdr.detectChanges();
      }
    });
  }

  // รวมยอดไข่ของวันที่กำหนด (เทียบแค่ปี/เดือน/วัน ไม่สนเวลา) - ใช้กับสรุปยอด
  // "วันนี้/เมื่อวาน" ด้านบน ซึ่งคงเป็นรายวันเสมอไม่ว่าโหมดกราฟจะเป็นอะไร
  private totalForDate(date: Date): number {
    const key = formatDateKey(date);
    return this.eggRecords
      .filter(r => {
        const d = new Date(r.date_collect_egg);
        return !isNaN(d.getTime()) && formatDateKey(d) === key;
      })
      .reduce((sum, r) => sum + (r.number_egg || 0), 0);
  }

  private totalForMonth(year: number, month: number): number {
    return this.eggRecords
      .filter(r => {
        const d = new Date(r.date_collect_egg);
        return !isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((sum, r) => sum + (r.number_egg || 0), 0);
  }

  private totalForYear(year: number): number {
    return this.eggRecords
      .filter(r => {
        const d = new Date(r.date_collect_egg);
        return !isNaN(d.getTime()) && d.getFullYear() === year;
      })
      .reduce((sum, r) => sum + (r.number_egg || 0), 0);
  }

  // ดึงเฉพาะรายการไข่ที่อยู่ในช่วงของแท่งกราฟนั้นๆ (ตามโหมดวัน/เดือน/ปี) ใช้ทั้ง
  // ตอนคลิกดูรายละเอียดและตอนเมาส์ชี้ดูยอดแยกคอก
  private recordsForBucket(bucketStart: Date, mode: ChartMode): EggRecord[] {
    return this.eggRecords.filter(r => {
      const d = new Date(r.date_collect_egg);
      if (isNaN(d.getTime())) return false;
      if (mode === 'day') return formatDateKey(d) === formatDateKey(bucketStart);
      if (mode === 'month') return d.getFullYear() === bucketStart.getFullYear() && d.getMonth() === bucketStart.getMonth();
      return d.getFullYear() === bucketStart.getFullYear();
    });
  }

  get todayTotal(): number {
    return this.totalForDate(new Date());
  }

  get yesterdayTotal(): number {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return this.totalForDate(y);
  }

  get trendDiff(): number {
    return this.todayTotal - this.yesterdayTotal;
  }

  get chartBars(): ChartBar[] {
    if (this.chartMode === 'month') return this.monthlyBars;
    if (this.chartMode === 'year') return this.yearlyBars;
    return this.dailyBars;
  }

  // กราฟแท่งย้อนหลัง 14 วัน - เติมวันที่ไม่มีข้อมูลด้วย 0 ให้เห็นช่วงห่างชัดเจน
  private get dailyBars(): ChartBar[] {
    const bars: ChartBar[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      bars.push({
        key: formatDateKey(d),
        label: String(d.getDate()),
        value: this.totalForDate(d),
        isCurrent: i === 0,
        bucketStart: d,
      });
    }
    return bars;
  }

  // กราฟแท่งย้อนหลัง 12 เดือน
  private get monthlyBars(): ChartBar[] {
    const bars: ChartBar[] = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      bars.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: THAI_MONTH_SHORT[d.getMonth()],
        value: this.totalForMonth(d.getFullYear(), d.getMonth()),
        isCurrent: i === 0,
        bucketStart: d,
      });
    }
    return bars;
  }

  // กราฟแท่งย้อนหลัง 5 ปี (แสดงเป็น พ.ศ.)
  private get yearlyBars(): ChartBar[] {
    const bars: ChartBar[] = [];
    const now = new Date();

    for (let i = 4; i >= 0; i--) {
      const y = now.getFullYear() - i;
      bars.push({
        key: String(y),
        label: String(y + 543),
        value: this.totalForYear(y),
        isCurrent: i === 0,
        bucketStart: new Date(y, 0, 1),
      });
    }
    return bars;
  }

  get chartMax(): number {
    return Math.max(1, ...this.chartBars.map(b => b.value));
  }

  barHeightPercent(value: number): number {
    if (value <= 0) return 0;
    // สูงอย่างน้อย 6% ให้เห็นแท่งจางๆแม้ค่าน้อยมากเทียบกับค่าสูงสุด
    return Math.max(6, (value / this.chartMax) * 100);
  }

  // แท่งที่กำลังถูกเลือกไว้ (คลิกดูรายละเอียด) - หาใหม่จาก key ทุกครั้งเพราะ
  // chartBars เป็น getter สร้าง array ใหม่ทุกรอบ
  get selectedBar(): ChartBar | undefined {
    return this.chartBars.find(b => b.key === this.selectedBarKey);
  }

  // รายการไข่ดิบของแท่งที่เลือก - ใช้ตอบ "คลิกดูว่าวันนั้นเก็บไข่วันไหน/เท่าไหร่"
  get selectedBarRecords(): EggRecord[] {
    const bar = this.selectedBar;
    if (!bar) return [];
    return this.recordsForBucket(bar.bucketStart, this.chartMode)
      .sort((a, b) => new Date(b.date_collect_egg).getTime() - new Date(a.date_collect_egg).getTime());
  }

  get selectedBarHeading(): string {
    const bar = this.selectedBar;
    if (!bar) return '';
    if (this.chartMode === 'year') return `ปี ${bar.label}`;
    if (this.chartMode === 'month') return `${THAI_MONTH_SHORT[bar.bucketStart.getMonth()]} ${bar.bucketStart.getFullYear() + 543}`;
    return bar.bucketStart.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // ยอดไข่แยกตามคอกของช่วงที่แท่งนี้เป็นตัวแทน - ใช้โชว์ในป็อบอัพตอนเมาส์ชี้
  // เวลาดูโหมด "ทุกคอก" จะได้รู้ว่าแต่ละคอกได้กี่ฟองแทนที่จะเห็นแค่ยอดรวม
  coopBreakdownForBar(bar: ChartBar): CoopEggTotal[] {
    const totals = new Map<number, number>();
    for (const r of this.recordsForBucket(bar.bucketStart, this.chartMode)) {
      const id = r.coop_id ?? -1;
      totals.set(id, (totals.get(id) || 0) + (r.number_egg || 0));
    }
    return Array.from(totals.entries())
      .map(([coopId, total]) => ({ name: this.coopNameFor(coopId), total }))
      .sort((a, b) => b.total - a.total);
  }

  get recentRecords(): EggRecord[] {
    return [...this.eggRecords]
      .sort((a, b) => new Date(b.date_collect_egg).getTime() - new Date(a.date_collect_egg).getTime())
      .slice(0, 6);
  }

  formatRecordDate(iso: string): string {
    return formatThaiDate(iso);
  }

  // backend ไม่ได้เติม name_coop ไว้ในตัวข้อมูลไข่เอง (ค่าว่างเปล่าเสมอ) ต้องเทียบ
  // coop_id กับรายชื่อคอกที่โหลดมาแยกเอาเอง - ใช้ตอนดูโหมด "ทุกคอก" เพื่อบอกว่า
  // แต่ละแถวประวัติเป็นของคอกไหน
  coopNameFor(coopId: number | undefined): string {
    if (coopId == null) return '';
    const coop = this.coops.find(c => c.coop_id === coopId);
    return coop ? (coop.name_coop || `คอกที่ ${coopId}`) : `คอกที่ ${coopId}`;
  }

  openCalendar() {
    this.closeDropdowns();
    this.isCalendarOpen = true;
    this.cdr.detectChanges();
  }

  closeCalendar() {
    this.isCalendarOpen = false;
    this.cdr.detectChanges();
  }

  onDaySelected(day: Date) {
    this.collectDate = day;
    this.isCalendarOpen = false;
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
    setTimeout(() => {
      this.showToast = false;
      this.cdr.detectChanges();
    }, 2500);
  }

  saveEgg() {
    if (!this.coopId || !this.eggCount || this.eggCount < 1 || !this.collectDate) {
      this.flashToast('กรุณาเลือกคอก จำนวนไข่ และวันที่เก็บไข่ให้ครบถ้วน', 'error');
      return;
    }

    this.isSaving = true;
    const payload = {
      coop_id: this.coopId,
      number_egg: this.eggCount,
      note: this.note,
      // ส่งเฉพาะ "วันที่" ตรงๆ ไม่ผ่าน toISOString() ของเวลาปัจจุบัน เพราะไทย
      // อยู่ UTC+7 - ถ้าเวลาขณะนั้นอยู่ช่วงเที่ยงคืน-ตี 7 การแปลงจะดันวันที่
      // ถอยหลังไป 1 วัน
      date_collect_egg: `${formatDateKey(this.collectDate)}T00:00:00Z`
    };

    this.api.post(`/eggs`, payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.eggCount = null;
        this.note = '';
        this.flashToast('บันทึกข้อมูลไข่ไก่สำเร็จ!', 'success');
        this.loadEggHistory();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isSaving = false;
        console.error('บันทึกข้อมูลไข่ไก่ไม่สำเร็จ:', err);
        this.flashToast('บันทึกข้อมูลไข่ไก่ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error');
        this.cdr.detectChanges();
      }
    });
  }
}
