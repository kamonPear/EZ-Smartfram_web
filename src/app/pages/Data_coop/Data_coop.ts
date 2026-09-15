import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Subscription, interval } from 'rxjs';
import { Device, EggRecord, HealthRecord, VaccineRecord, formatThaiDate } from '../../shared/coop-summary.util';
import { deviceIconSrc } from '../../shared/device-icon.util';
import { DayMarker, loadCalendarMarkers, formatDateKey } from '../../shared/calendar-markers.util';
import { getManualHealthAppointments } from '../../shared/manual-health-appointment.util';
import { DatePickerCalendar } from '../../shared/date-picker-calendar/date-picker-calendar';

interface SlotPreview {
  id: number;
  device: Device | null;
  x: number; // ตำแหน่งแนวนอน (%) - คำนวณจากช่อง 7x3 ให้ตรงกับหน้าจัดวางระบบ/สถานะอุปกรณ์
  y: number; // ตำแหน่งแนวตั้ง (%)
}

interface EggBar {
  key: string;
  label: string;
  value: number;
  isToday: boolean;
  bucketStart: Date;
}

interface PendingVaccine {
  id: string;
  vaccineName: string;
  method: string;
  date: Date;
  daysUntil: number;
}

@Component({
  selector: 'app-data-coop',
  standalone: true,
  imports: [CommonModule, RouterModule, DatePickerCalendar],
  templateUrl: './Data_coop.html',
  styleUrls: ['./Data_coop.scss']
})
export class DataCoopComponent implements OnInit, OnDestroy {

  deviceIconSrc = deviceIconSrc;

  selectedCoop: string | null = null;
  selectedCoopName: string | null = null;
  isLoading: boolean = false;

  formatThaiDate = formatThaiDate;

  chickenCount: number | null = null;
  birthDate: Date | null = null;
  receivedDate: Date | null = null;
  note: string = '';

  devicesList: Device[] = [];
  healthRecords: HealthRecord[] = [];
  vaccineRecords: VaccineRecord[] = [];
  eggRecords: EggRecord[] = [];

  // คลิก/ชี้เมาส์ที่แท่งกราฟไข่ดูรายละเอียดของวันนั้นได้ (เหมือนหน้าเพิ่มไข่)
  hoveredEggBarKey: string | null = null;
  selectedEggBarKey: string | null = null;

  // พรีวิวผังตำแหน่งอุปกรณ์แบบย่อ (ช่อง 7x3 เดียวกับหน้าจัดวางระบบ/สถานะอุปกรณ์)
  // ให้เห็นทันทีว่ามุมไหนของคอกมีอุปกรณ์แล้ว มุมไหนยังว่างอยู่ ไม่ต้องกดเข้าไปดู
  // อีกหน้าก่อน - วางได้อิสระ ไม่ใช่ "ช่อง" ตายตัว จึงไม่ใช้คำว่า "ช่องว่าง" ในป้ายกำกับ
  slots: SlotPreview[] = [];
  hoveredSlotId: number | null = null;

  // ป็อบอัพประวัติสุขภาพ/วัคซีน - หน้าหลักโชว์แค่ "ล่าสุด" เป็นแดชบอร์ด กดดูย้อนหลัง
  // ทั้งหมดค่อยเด้งป็อบอัพ ไม่ต้องยัดประวัติทั้งหมดโชว์ค้างไว้ตลอด
  showHealthHistory = false;
  showVaccineHistory = false;

  // วัคซีนที่คอกนี้ยังไม่ได้ให้ (คำนวณจากตารางประเภทวัคซีนเทียบอายุไก่ เหมือน
  // หน้า "ให้วัคซีน") - โชว์แค่ที่ยังไม่ให้ ไม่ใช่ทั้งหมด
  pendingVaccines: PendingVaccine[] = [];

  // ปฏิทินของคอกนี้โดยเฉพาะ (ไม่รวมคอกอื่น)
  isCalendarOpen = false;
  dayMarkers: Map<string, DayMarker> | null = null;

  private refreshSubscription!: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const state = history.state;
    if (state && state.coopNumber) {
      this.selectedCoop = state.coopNumber;
    }

    this.route.queryParams.subscribe(params => {
      if (params['coop']) {
        this.selectedCoop = params['coop'];
      }

      if (this.selectedCoop) {
        this.fetchCoopDetails();
        this.fetchPendingVaccines();
        this.loadMarkers();
        this.startAutoRefresh();
      } else {
        console.warn('No selectedCoop. API fetch aborted.');
      }
    });
  }

  ngOnDestroy() {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  private applyCoopDetails(data: any) {
    if (data?.name_coop) {
      this.selectedCoopName = data.name_coop;
    }
    this.chickenCount = data?.amount ?? null;
    this.birthDate = data?.birthday ? new Date(data.birthday) : null;
    this.receivedDate = data?.date_adopt_animals ? new Date(data.date_adopt_animals) : null;
    this.note = data?.note || '';
    this.devicesList = data?.devices || [];
    this.healthRecords = data?.health || [];
    this.vaccineRecords = data?.vaccines || [];
    this.eggRecords = data?.eggs || [];
    this.buildSlots();
  }

  // สร้างช่อง 7x3 (21 ช่อง) เดียวกับที่หน้าจัดวางระบบ/สถานะอุปกรณ์ใช้ แล้ววาง
  // อุปกรณ์ตาม slot_index ของมันลงไป (แค่ใช้คำนวณตำแหน่งแสดงผลคร่าวๆ อุปกรณ์
  // วางได้อิสระจริงๆ ไม่ได้ผูกกับช่องตายตัว)
  private buildSlots() {
    this.slots = Array.from({ length: 21 }, (_, i) => {
      const row = Math.floor(i / 7);
      const col = i % 7;
      return {
        id: i,
        device: null,
        x: ((col + 0.5) / 7) * 100,
        y: ((row + 0.5) / 3) * 100,
      };
    });

    for (const device of this.devicesList) {
      const index = device.slot_index;
      if (index != null && index >= 0 && index < 21) {
        this.slots[index].device = device;
      }
    }
  }

  get filledSlotCount(): number {
    return this.slots.filter(s => s.device).length;
  }

  // buildSlots() สร้าง array ใหม่ทุกครั้งที่ข้อมูลรีเฟรช (auto-refresh ทุก 5
  // วิ) - ต้องมี trackBy ให้ *ngFor ไม่ทำลาย/สร้าง DOM ใหม่หมดกลางที่เมาส์ชี้
  // อยู่ (ไม่งั้น mouseleave จะไม่ทำงาน ป็อบอัพติดค้าง) และแอปนี้ไม่มี zone.js
  // เลย ต้องยิง detectChanges() เองตรงๆ ตอนเปลี่ยน hoveredSlotId ด้วย
  trackBySlotId(_index: number, slot: SlotPreview): number {
    return slot.id;
  }

  onSlotHoverStart(slotId: number) {
    this.hoveredSlotId = slotId;
    this.cdr.detectChanges();
  }

  onSlotHoverEnd() {
    this.hoveredSlotId = null;
    this.cdr.detectChanges();
  }

  fetchCoopDetails(silent = false) {
    if (!this.selectedCoop) return;
    if (!silent) this.isLoading = true;

    this.api.get<any>(`/coops?id=${this.selectedCoop}`).subscribe({
      next: (data) => {
        this.applyCoopDetails(data);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('ดึงข้อมูลคอกล้มเหลว:', err);
        this.cdr.detectChanges();
      }
    });
  }

  // วัคซีนที่ยังไม่ได้ให้ของคอกนี้ - คำนวณเดียวกับหน้า "ให้วัคซีน" (Give_vaccine)
  fetchPendingVaccines(silent = false) {
    if (!this.selectedCoop) return;
    this.api.get<any[]>('/vaccines/alerts').subscribe({
      next: (alerts) => {
        const today = new Date();
        const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        this.pendingVaccines = (alerts || [])
          .filter(a => String(a?.coop_id) === String(this.selectedCoop) && a?.is_completed !== true && a?.date)
          .map(a => {
            const d = new Date(a.date);
            const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            return {
              id: a.id,
              vaccineName: a.vaccine_name || 'วัคซีน',
              method: a.injection_type || '-',
              date: dateOnly,
              daysUntil: Math.round((dateOnly.getTime() - todayOnly.getTime()) / 86400000),
            };
          })
          .sort((a, b) => a.date.getTime() - b.date.getTime());
        if (!silent) this.cdr.detectChanges();
      },
      error: (err) => console.error('โหลดข้อมูลวัคซีนที่ต้องให้ไม่สำเร็จ:', err)
    });
  }

  loadMarkers() {
    // ปฏิทินของคอกนี้เท่านั้น (ส่ง coopId กรองไว้) ไม่รวมคอกอื่น
    loadCalendarMarkers(this.api, Number(this.selectedCoop)).subscribe({
      next: (markers) => {
        this.dayMarkers = markers;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('โหลดข้อมูลมาร์คปฏิทินไม่สำเร็จ:', err)
    });
  }

  openCalendar() {
    this.isCalendarOpen = true;
    this.cdr.detectChanges();
  }

  closeCalendar() {
    this.isCalendarOpen = false;
    this.cdr.detectChanges();
  }

  startAutoRefresh() {
    if (!this.refreshSubscription) {
      this.refreshSubscription = interval(5000).subscribe(() => {
        this.fetchCoopDetails(true);
        this.fetchPendingVaccines(true);
      });
    }
  }

  formatDate(date: Date | null): string {
    if (!date) return '-';
    return date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  get deviceOnlineCount(): number {
    return this.devicesList.filter(d => d.current_status === 'Online').length;
  }

  // กราฟแท่งไข่ที่เก็บได้ของคอกนี้ ย้อนหลัง 14 วัน (คล้ายหน้าเพิ่มไข่ แต่ย่อลง
  // มาแสดงในแดชบอร์ดนี้)
  get eggBars(): EggBar[] {
    const bars: EggBar[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = formatDateKey(d);
      const value = this.eggRecords
        .filter(r => {
          const rd = new Date(r.date_collect_egg);
          return !isNaN(rd.getTime()) && formatDateKey(rd) === key;
        })
        .reduce((sum, r) => sum + (r.number_egg || 0), 0);
      bars.push({ key, label: String(d.getDate()), value, isToday: i === 0, bucketStart: d });
    }
    return bars;
  }

  get eggChartMax(): number {
    return Math.max(1, ...this.eggBars.map(b => b.value));
  }

  eggBarHeightPercent(value: number): number {
    if (value <= 0) return 0;
    return Math.max(6, (value / this.eggChartMax) * 100);
  }

  get todayEggTotal(): number {
    const bars = this.eggBars;
    return bars.length ? bars[bars.length - 1].value : 0;
  }

  trackByEggBarKey(_index: number, bar: EggBar): string {
    return bar.key;
  }

  onEggBarHoverStart(bar: EggBar) {
    this.hoveredEggBarKey = bar.key;
    this.cdr.detectChanges();
  }

  onEggBarHoverEnd() {
    this.hoveredEggBarKey = null;
    this.cdr.detectChanges();
  }

  selectEggBar(bar: EggBar) {
    this.selectedEggBarKey = this.selectedEggBarKey === bar.key ? null : bar.key;
  }

  get selectedEggBar(): EggBar | undefined {
    return this.eggBars.find(b => b.key === this.selectedEggBarKey);
  }

  get selectedEggBarRecords(): EggRecord[] {
    const bar = this.selectedEggBar;
    if (!bar) return [];
    return this.eggRecords
      .filter(r => {
        const rd = new Date(r.date_collect_egg);
        return !isNaN(rd.getTime()) && formatDateKey(rd) === bar.key;
      })
      .sort((a, b) => new Date(b.date_collect_egg).getTime() - new Date(a.date_collect_egg).getTime());
  }

  get selectedEggBarHeading(): string {
    const bar = this.selectedEggBar;
    if (!bar) return '';
    return bar.bucketStart.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // สุขภาพ "ล่าสุด" เท่านั้นสำหรับแดชบอร์ดหลัก - ประวัติทั้งหมดย้อนหลังไปดูผ่าน
  // ป็อบอัพต่างหาก (showHealthHistory)
  get latestHealthRecord(): HealthRecord | null {
    if (this.healthRecords.length === 0) return null;
    return [...this.healthRecords].sort((a, b) => new Date(b.record_date).getTime() - new Date(a.record_date).getTime())[0];
  }

  get healthHistorySorted(): HealthRecord[] {
    return [...this.healthRecords].sort((a, b) => new Date(b.record_date).getTime() - new Date(a.record_date).getTime());
  }

  // นัดตรวจสุขภาพถัดไปของคอกนี้ - มีได้ 2 แหล่ง: วันก่อนวัคซีนที่ใกล้ครบกำหนดที่สุด 1
  // วัน (คำนวณเดียวกับ Add_health, ใช้ pendingVaccines ที่โหลดไว้แล้วไม่ต้องยิง API ซ้ำ)
  // หรือนัดที่กำหนดวันเองจากโหมด "นัดตรวจสุขภาพเอง" (เก็บใน localStorage) - เอาที่ใกล้สุด
  get healthAppointment(): { appointmentDate: Date; vaccineName: string | null; vaccineDate: Date | null; isFuture: boolean } | null {
    const vaccineCandidates = this.pendingVaccines.map(v => {
      const appointmentDate = new Date(v.date);
      appointmentDate.setDate(appointmentDate.getDate() - 1);
      return { appointmentDate, vaccineName: v.vaccineName as string | null, vaccineDate: v.date as Date | null };
    });
    const manualCandidates = getManualHealthAppointments(Number(this.selectedCoop)).map(m => ({
      appointmentDate: new Date(m.date),
      vaccineName: null as string | null,
      vaccineDate: null as Date | null,
    }));

    // นัดที่กำหนดเองอยู่ก่อนวัคซีนในลิสต์ตั้งใจ - ถ้าวันที่ตรงกันเป๊ะ (sort เสถียร) นัด
    // ที่กำหนดเองจะ "ชนะ" แสดงเป็นนัดที่เรากำหนดเอง ไม่ใช่นัดจากวัคซีนซ้ำวันเดียวกัน
    const candidates = [...manualCandidates, ...vaccineCandidates].sort((a, b) => a.appointmentDate.getTime() - b.appointmentDate.getTime());
    if (candidates.length === 0) return null;

    const nearest = candidates[0];
    const today = new Date();
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return {
      ...nearest,
      isFuture: nearest.appointmentDate.getTime() > todayOnly.getTime(),
    };
  }

  formatDateObj(d: Date): string {
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  get vaccineHistorySorted(): VaccineRecord[] {
    return [...this.vaccineRecords].sort((a, b) => new Date(b.record_date).getTime() - new Date(a.record_date).getTime());
  }

  vaccineStatusLabel(v: PendingVaccine): string {
    if (v.daysUntil < 0) return `เลยกำหนดมา ${-v.daysUntil} วัน`;
    if (v.daysUntil === 0) return 'ถึงกำหนดวันนี้';
    if (v.daysUntil === 1) return 'พรุ่งนี้ถึงกำหนด';
    return `อีก ${v.daysUntil} วัน`;
  }

  vaccineStatusClass(v: PendingVaccine): string {
    if (v.daysUntil <= 0) return 'is-danger';
    if (v.daysUntil === 1) return 'is-warning';
    return 'is-ok';
  }

  goToDeviceStatus() {
    this.router.navigate(['/device-status'], { queryParams: { coop: this.selectedCoop } });
  }

  goToHealthCheck() {
    this.router.navigate(['/add-health'], { queryParams: { coop_id: this.selectedCoop } });
  }

  goToGiveVaccine() {
    this.router.navigate(['/give-vaccine'], { queryParams: { coop_id: this.selectedCoop } });
  }

  goToAddEgg() {
    this.router.navigate(['/add-egg'], { queryParams: { coop_id: this.selectedCoop } });
  }
}
