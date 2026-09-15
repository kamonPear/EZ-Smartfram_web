import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { DatePickerCalendar } from '../../shared/date-picker-calendar/date-picker-calendar';
import { DayMarker, loadCalendarMarkers, formatDateKey } from '../../shared/calendar-markers.util';
import { getManualHealthAppointments } from '../../shared/manual-health-appointment.util';
import { HealthRecord, formatThaiDate } from '../../shared/coop-summary.util';

type ChartMode = 'day' | 'month' | 'year';

interface ChartBar {
  key: string;
  label: string;
  value: number;
  isCurrent: boolean;
  bucketStart: Date;
}

const THAI_MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

@Component({
  selector: 'app-add-health',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, DatePickerCalendar],
  templateUrl: './Add_health.html',
  styleUrls: ['./Add_health.scss']
})
export class AddHealthComponent {

  collectDate: Date | null = new Date();
  isCalendarOpen: boolean = false;
  dayMarkers: Map<string, DayMarker> | null = null;

  coops: any[] = [];

  // คอกของฟอร์ม "บันทึกสุขภาพ"
  coopId: number | null = null;
  healthyCount: number | null = null;
  poorHealthCount: number | null = null;
  note: string = '';
  isCoopDropdownOpen: boolean = false;

  // คอกของ "แผงสรุปผล" - แยกอิสระจากคอกของฟอร์มบันทึก เหมือนหน้าเพิ่มไข่
  statsCoopId: number | null = null;
  isStatsCoopDropdownOpen: boolean = false;

  // เปิดมาจากหน้า "ข้อมูลคอกไก่"/"นัดตรวจสุขภาพ" ด้วย coop_id ที่ระบุมาแน่นอนแล้ว
  // (ไม่ใช่แค่พรีเซ็ตค่าเริ่มต้น) - ล็อกคอกทั้งฟอร์มบันทึกและแผงสรุปผลไว้ ไม่ต้อง
  // ให้เลือกคอกซ้ำอีกรอบ ตามที่ผู้ใช้ขอ
  isCoopLocked = false;
  // เปิดมาจากหน้า "นัดตรวจสุขภาพ" โหมดอัตโนมัติด้วย - วันนัดคำนวณมาให้แล้ว
  // (วันก่อนให้วัคซีน 1 วัน) ล็อกวันที่ไว้เลย ไม่ต้องให้เลือกวันที่ซ้ำอีกรอบ
  isDateLocked = false;
  // เปิดมาจากปุ่ม "ตรวจสุขภาพ" ในหน้าข้อมูลคอกไก่ (มีแค่ coop_id ไม่มี date มาด้วย)
  // - หน้านี้ต้องคำนวณวันนัดตรวจเองจากวันครบกำหนดวัคซีนที่ใกล้ที่สุดของคอกนั้น
  // (เหมือนหน้านัดตรวจสุขภาพโหมดอัตโนมัติ) แล้วล็อกวันที่ไว้ ไม่ให้เลือกเอง
  isLoadingAppointment = false;
  hasNoAppointment = false;
  appointmentVaccineName: string | null = null;
  appointmentVaccineDate: Date | null = null;

  healthRecords: HealthRecord[] = [];
  isLoadingHistory = false;
  chartMode: ChartMode = 'day';

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
    // เปิดมาจากหน้า "ข้อมูลคอกไก่" หรือ "นัดตรวจสุขภาพ" ได้ด้วย - รับ coop_id/date
    // มาพรีเซ็ตทั้งฟอร์มบันทึกและแผงสรุปผลให้ตรงกับคอก/วันที่ที่ตั้งใจมาเลย
    const params = this.route.snapshot.queryParamMap;
    const coopIdParam = Number(params.get('coop_id'));
    const dateParam = params.get('date');
    if (!isNaN(coopIdParam) && coopIdParam > 0) {
      this.coopId = coopIdParam;
      this.statsCoopId = coopIdParam;
      this.isCoopLocked = true;
    }
    if (dateParam) {
      const d = new Date(dateParam);
      if (!isNaN(d.getTime())) {
        this.collectDate = d;
        this.isDateLocked = true;
      }
    } else if (this.isCoopLocked) {
      // มาจากปุ่ม "ตรวจสุขภาพ" ในหน้าข้อมูลคอกไก่ตรงๆ (ไม่มี date มาด้วย) -
      // ต้องคำนวณวันนัดเองจากวัคซีนที่ใกล้ครบกำหนดที่สุดของคอกนี้
      this.computeNearestAppointment();
    }

    this.loadCoops();
    this.loadMarkers();
    this.loadHealthHistory();
  }

  // คำนวณวันนัดตรวจสุขภาพถัดไปของคอกนี้ - มีได้ 2 แหล่ง: (1) ก่อนวันครบกำหนดวัคซีน
  // ที่ใกล้ที่สุด 1 วันเสมอ เหมือนหน้า "นัดตรวจสุขภาพ" โหมดอัตโนมัติ (2) นัดที่กำหนด
  // วันเองจากโหมด "นัดตรวจสุขภาพเอง" (เก็บใน localStorage - ไม่ต้องรอวัคซีน) เอาที่ใกล้
  // ที่สุดจากทั้งสองแหล่งมาล็อกวันที่ไว้เลย
  private computeNearestAppointment() {
    if (!this.coopId) return;
    this.isLoadingAppointment = true;
    this.collectDate = null;

    const manualCandidates = getManualHealthAppointments(this.coopId).map(m => ({
      vaccineName: null as string | null,
      vaccineDate: null as Date | null,
      appointmentDate: new Date(m.date),
    }));

    const finish = (vaccineCandidates: { vaccineName: string | null; vaccineDate: Date | null; appointmentDate: Date }[]) => {
      // นัดที่กำหนดเองอยู่ก่อนวัคซีนในลิสต์ตั้งใจ - ถ้าวันที่ตรงกันเป๊ะ (sort เสถียร)
      // นัดที่กำหนดเองจะ "ชนะ" แสดงเป็นนัดที่เรากำหนดเอง ไม่ใช่นัดจากวัคซีนซ้ำวันเดียวกัน
      const candidates = [...manualCandidates, ...vaccineCandidates]
        .filter(c => !isNaN(c.appointmentDate.getTime()))
        .sort((a, b) => a.appointmentDate.getTime() - b.appointmentDate.getTime());

      if (candidates.length > 0) {
        const nearest = candidates[0];
        this.collectDate = nearest.appointmentDate;
        this.appointmentVaccineName = nearest.vaccineName;
        this.appointmentVaccineDate = nearest.vaccineDate;
        this.hasNoAppointment = false;
      } else {
        this.collectDate = null;
        this.hasNoAppointment = true;
      }
      this.isDateLocked = true;
      this.isLoadingAppointment = false;
      this.cdr.detectChanges();
    };

    this.api.get<any[]>('/vaccines/alerts').subscribe({
      next: (alerts) => {
        const vaccineCandidates = (alerts || [])
          .filter(a => String(a?.coop_id) === String(this.coopId) && a?.is_completed !== true && a?.date)
          .map(a => {
            const vaccineDate = new Date(a.date);
            const appointmentDate = new Date(vaccineDate);
            appointmentDate.setDate(appointmentDate.getDate() - 1);
            return { vaccineName: (a.vaccine_name || 'วัคซีน') as string | null, vaccineDate: vaccineDate as Date | null, appointmentDate };
          });
        finish(vaccineCandidates);
      },
      error: (err) => {
        console.error('คำนวณวันนัดตรวจสุขภาพไม่สำเร็จ:', err);
        finish([]);
      }
    });
  }

  // วันนัดที่ล็อกไว้ยังไม่ถึง (อยู่ในอนาคต) - บันทึกผลตรวจล่วงหน้าไม่ได้
  get isFutureCheckDate(): boolean {
    if (!this.collectDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(this.collectDate);
    target.setHours(0, 0, 0, 0);
    return target.getTime() > today.getTime();
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
    this.loadHealthHistory();
  }

  closeDropdowns() {
    this.isCoopDropdownOpen = false;
    this.isStatsCoopDropdownOpen = false;
  }

  setChartMode(mode: ChartMode) {
    this.chartMode = mode;
    this.selectedBarKey = null;
  }

  selectBar(bar: ChartBar) {
    this.selectedBarKey = this.selectedBarKey === bar.key ? null : bar.key;
  }

  onBarHoverStart(bar: ChartBar) {
    this.hoveredBarKey = bar.key;
    this.cdr.detectChanges();
  }

  onBarHoverEnd() {
    this.hoveredBarKey = null;
    this.cdr.detectChanges();
  }

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

  // ดึงประวัติสุขภาพสำหรับแผงสรุปผล: ทั้งฟาร์ม (/healths) หรือของคอกเดียว
  // (/healths?coop_id=) แล้วแต่ statsCoopId
  loadHealthHistory() {
    this.isLoadingHistory = true;
    const endpoint = this.statsCoopId != null ? `/healths?coop_id=${this.statsCoopId}` : `/healths`;
    this.api.get<HealthRecord[]>(endpoint).subscribe({
      next: (data) => {
        this.healthRecords = data || [];
        this.isLoadingHistory = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('โหลดประวัติสุขภาพไม่สำเร็จ:', err);
        this.healthRecords = [];
        this.isLoadingHistory = false;
        this.cdr.detectChanges();
      }
    });
  }

  private matchesDate(record: HealthRecord, date: Date): boolean {
    const d = new Date(record.record_date);
    return !isNaN(d.getTime()) && formatDateKey(d) === formatDateKey(date);
  }

  private totalHealthyForDate(date: Date): number {
    return this.healthRecords.filter(r => this.matchesDate(r, date)).reduce((s, r) => s + (r.healthy || 0), 0);
  }

  private totalPoorForDate(date: Date): number {
    return this.healthRecords.filter(r => this.matchesDate(r, date)).reduce((s, r) => s + (r.poor_health || 0), 0);
  }

  get todayHealthy(): number {
    return this.totalHealthyForDate(new Date());
  }

  get todayPoor(): number {
    return this.totalPoorForDate(new Date());
  }

  // ดึงเฉพาะรายการสุขภาพที่อยู่ในช่วงของแท่งกราฟนั้นๆ (ตามโหมดวัน/เดือน/ปี)
  private recordsForBucket(bucketStart: Date, mode: ChartMode): HealthRecord[] {
    return this.healthRecords.filter(r => {
      const d = new Date(r.record_date);
      if (isNaN(d.getTime())) return false;
      if (mode === 'day') return formatDateKey(d) === formatDateKey(bucketStart);
      if (mode === 'month') return d.getFullYear() === bucketStart.getFullYear() && d.getMonth() === bucketStart.getMonth();
      return d.getFullYear() === bucketStart.getFullYear();
    });
  }

  private totalPoorInBucket(bucketStart: Date, mode: ChartMode): number {
    return this.recordsForBucket(bucketStart, mode).reduce((s, r) => s + (r.poor_health || 0), 0);
  }

  // กราฟแท่งติดตามจำนวน "ไก่ป่วย" (ตัวเลขที่เจ้าของฟาร์มต้องจับตาดูมากที่สุด)
  // ย้อนหลัง 14 วัน/12 เดือน/5 ปี ตามโหมดที่เลือก
  get chartBars(): ChartBar[] {
    if (this.chartMode === 'month') return this.monthlyBars;
    if (this.chartMode === 'year') return this.yearlyBars;
    return this.dailyBars;
  }

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
        value: this.totalPoorInBucket(d, 'day'),
        isCurrent: i === 0,
        bucketStart: d,
      });
    }
    return bars;
  }

  private get monthlyBars(): ChartBar[] {
    const bars: ChartBar[] = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      bars.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: THAI_MONTH_SHORT[d.getMonth()],
        value: this.totalPoorInBucket(d, 'month'),
        isCurrent: i === 0,
        bucketStart: d,
      });
    }
    return bars;
  }

  private get yearlyBars(): ChartBar[] {
    const bars: ChartBar[] = [];
    const now = new Date();

    for (let i = 4; i >= 0; i--) {
      const y = now.getFullYear() - i;
      bars.push({
        key: String(y),
        label: String(y + 543),
        value: this.totalPoorInBucket(new Date(y, 0, 1), 'year'),
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
    return Math.max(6, (value / this.chartMax) * 100);
  }

  get selectedBar(): ChartBar | undefined {
    return this.chartBars.find(b => b.key === this.selectedBarKey);
  }

  get selectedBarRecords(): HealthRecord[] {
    const bar = this.selectedBar;
    if (!bar) return [];
    return this.recordsForBucket(bar.bucketStart, this.chartMode)
      .sort((a, b) => new Date(b.record_date).getTime() - new Date(a.record_date).getTime());
  }

  get selectedBarHeading(): string {
    const bar = this.selectedBar;
    if (!bar) return '';
    if (this.chartMode === 'year') return `ปี ${bar.label}`;
    if (this.chartMode === 'month') return `${THAI_MONTH_SHORT[bar.bucketStart.getMonth()]} ${bar.bucketStart.getFullYear() + 543}`;
    return bar.bucketStart.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  get recentRecords(): HealthRecord[] {
    return [...this.healthRecords]
      .sort((a, b) => new Date(b.record_date).getTime() - new Date(a.record_date).getTime())
      .slice(0, 6);
  }

  formatRecordDate(iso: string): string {
    return formatThaiDate(iso);
  }

  coopNameFor(coopId: number | undefined): string {
    if (coopId == null) return '';
    const coop = this.coops.find(c => c.coop_id === coopId);
    return coop ? (coop.name_coop || `คอกที่ ${coopId}`) : `คอกที่ ${coopId}`;
  }

  openCalendar() {
    if (this.isDateLocked) return;
    this.closeDropdowns();
    this.isCalendarOpen = true;
    this.cdr.detectChanges();
  }

  // จำนวนไก่ทั้งหมดของคอกที่กำลังบันทึก - ใช้บอกไว้ก่อนกรอก และเช็คตอนบันทึกว่า
  // "สุขภาพดี + ป่วย" ต้องรวมได้เท่ากับจำนวนไก่ทั้งหมดของคอกนี้เป๊ะ (กันกรอกขาด/เกิน)
  get totalChickens(): number | null {
    const coop = this.coops.find(c => c.coop_id === this.coopId);
    return coop?.amount ?? null;
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

  saveHealth() {
    if (this.hasNoAppointment) {
      this.flashToast('คอกนี้ยังไม่มีนัดตรวจสุขภาพในตอนนี้ บันทึกไม่ได้', 'error');
      return;
    }

    if (!this.coopId || this.healthyCount == null || this.poorHealthCount == null || !this.collectDate) {
      this.flashToast('กรุณาเลือกคอกและกรอกจำนวนไก่ให้ครบถ้วน', 'error');
      return;
    }

    // ✅ บันทึกผลตรวจล่วงหน้าไม่ได้ - ต้องรอถึงวันนัดจริงก่อน
    if (this.isFutureCheckDate) {
      this.flashToast(`ยังไม่ถึงวันตรวจ (นัดวันที่ ${this.formatDate(this.collectDate)}) กรุณารอถึงวันนัดก่อนบันทึก`, 'error');
      return;
    }

    // ✅ กันกรอกจำนวนไก่ผิด: สุขภาพดี + ป่วย ต้องรวมได้เท่ากับจำนวนไก่ทั้งหมด
    // ของคอกนี้เป๊ะ (ตรงกับที่แอปมือถือเช็คไว้ตอนบันทึกผลตรวจ)
    const total = this.totalChickens;
    const enteredTotal = this.healthyCount + this.poorHealthCount;
    if (total != null && enteredTotal !== total) {
      this.flashToast(`จำนวนไก่ไม่ตรงกับที่มีจริง (คอกนี้มี ${total} ตัว แต่กรอกรวม ${enteredTotal} ตัว) กรุณาตรวจสอบก่อนบันทึก`, 'error');
      return;
    }

    this.isSaving = true;
    const payload = {
      coop_id: this.coopId,
      healthy: this.healthyCount,
      poor_health: this.poorHealthCount,
      note: this.note,
      record_date: `${formatDateKey(this.collectDate)}T00:00:00Z`
    };

    this.api.post(`/healths`, payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.healthyCount = null;
        this.poorHealthCount = null;
        this.note = '';
        this.flashToast('บันทึกข้อมูลสุขภาพสำเร็จ!', 'success');
        this.loadHealthHistory();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isSaving = false;
        console.error('บันทึกข้อมูลสุขภาพไม่สำเร็จ:', err);
        this.flashToast('บันทึกข้อมูลสุขภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error');
        this.cdr.detectChanges();
      }
    });
  }
}
