import { Component, OnInit, OnDestroy, ChangeDetectorRef, Injector, Type } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterModule, ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Subscription, interval, of } from 'rxjs';
import { Device, EggRecord, HealthRecord, VaccineRecord, formatThaiDate, formatChickenAge, legacyGridPosition } from '../../shared/coop-summary.util';
import { deviceIconSrc } from '../../shared/device-icon.util';
import { DayMarker, loadCalendarMarkers, formatDateKey } from '../../shared/calendar-markers.util';
import { HealthAppointmentService, HealthAppointment } from '../../services/health-appointment.service';
import { DatePickerCalendar } from '../../shared/date-picker-calendar/date-picker-calendar';
import { SetUpSystem } from '../Set_up_System/Set_up_System';
import { DeviceStatusComponent } from '../Device_status/Device_status';
import { AddEggComponent } from '../Add_egg/Add_egg';
import { AddHealthComponent } from '../Add_health/Add_health';
import { GiveVaccineComponent } from '../Give_vaccine/Give_vaccine';
import { linePointPercent, smoothLinePaths } from '../../shared/line-chart.util';
import { ArrivalVaccineNote, loadArrivalVaccineNote } from '../../shared/arrival-vaccine.util';
import { ArrivalVaccineNoteComponent } from '../../components/arrival-vaccine-note/arrival-vaccine-note.component';

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

// รายการวัคซีนทั้งหมดที่เข้าเกณฑ์อายุของคอกนี้ (ต่างจาก PendingVaccine ตรงที่รวม
// ตัวที่ให้ไปแล้วด้วย ไม่ใช่แค่ที่ยังไม่ให้) ใช้โชว์ในกรอบ "วัคซีนที่ให้"
interface VaccineChecklistItem extends PendingVaccine {
  isCompleted: boolean;
}

@Component({
  selector: 'app-data-coop',
  standalone: true,
  imports: [CommonModule, RouterModule, DatePickerCalendar, SetUpSystem, DeviceStatusComponent, ArrivalVaccineNoteComponent],
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

  // ตรวจจับความเคลื่อนไหวที่วงกบประตู (เซนเซอร์ PIR) เฉพาะของคอกนี้ - จำนวนครั้ง
  // และเวลาที่ตรวจจับล่าสุด ภายใน 24 ชม.ล่าสุด (backend กรองช่วงเวลาให้แล้ว)
  motionCount: number = 0;
  motionLastAt: Date | null = null;

  // คลิก/ชี้เมาส์ที่แท่งกราฟไข่ดูรายละเอียดของวันนั้นได้ (เหมือนหน้าเพิ่มไข่)
  hoveredEggBarKey: string | null = null;
  selectedEggBarKey: string | null = null;

  // พรีวิวผังตำแหน่งอุปกรณ์แบบย่อ (ช่อง 7x3 เดียวกับหน้าจัดวางระบบ/สถานะอุปกรณ์)
  // ให้เห็นทันทีว่ามุมไหนของคอกมีอุปกรณ์แล้ว มุมไหนยังว่างอยู่ ไม่ต้องกดเข้าไปดู
  // อีกหน้าก่อน - วางได้อิสระ ไม่ใช่ "ช่อง" ตายตัว จึงไม่ใช้คำว่า "ช่องว่าง" ในป้ายกำกับ
  slots: SlotPreview[] = [];
  hoveredSlotId: number | null = null;

  // วัคซีนที่คอกนี้ยังไม่ได้ให้ (คำนวณจากตารางประเภทวัคซีนเทียบอายุไก่ เหมือน
  // หน้า "ให้วัคซีน") - ใช้คำนวณ "นัดตรวจสุขภาพถัดไป" ใน healthAppointment ด้านล่าง
  // เท่านั้น (ต้องเป็นแค่ที่ยังไม่ให้ ไม่งั้นจะไปแนะนำนัดตรวจก่อนวัคซีนที่ให้ไปแล้ว)
  // ส่วนที่โชว์ในกรอบ "วัคซีนที่ให้" ใช้ vaccineChecklist (รวมทุกตัว) แทน
  pendingVaccines: PendingVaccine[] = [];
  vaccineChecklist: VaccineChecklistItem[] = [];
  // ไก่ที่รับเข้าฟาร์มตอนโตแล้ว - วัคซีนที่เลยช่วงอายุไปก่อนเข้าฟาร์ม (null = ไม่มี) ใช้อธิบายในกรอบ
  // ตรวจสุขภาพ/วัคซีนว่าทำไมว่าง (shared/arrival-vaccine.util.ts)
  arrivalNote: ArrivalVaccineNote | null = null;

  // นัดตรวจสุขภาพที่กำหนดวันเองของคอกนี้ (จาก backend แล้ว - ไม่ใช่ localStorage
  // อีกต่อไป) ใช้ร่วมกับ pendingVaccines ใน healthAppointment getter ด้านล่าง
  manualAppointments: HealthAppointment[] = [];

  // ปฏิทินของคอกนี้โดยเฉพาะ (ไม่รวมคอกอื่น)
  isCalendarOpen = false;
  dayMarkers: Map<string, DayMarker> | null = null;

  private refreshSubscription!: Subscription;
  private detailsInFlight: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private healthAppointmentService: HealthAppointmentService,
    private cdr: ChangeDetectorRef,
    private injector: Injector
  ) {}

  ngOnInit() {
    const state = history.state;
    if (state && state.coopNumber) {
      this.selectedCoop = state.coopNumber;
    }

    this.route.queryParams.subscribe(params => {
      if (params['coop']) {
        if (this.selectedCoop && this.selectedCoop !== params['coop']) {
          // เปลี่ยนคอก - ล้างข้อมูลคอกเดิมก่อน กันของคอกเก่าค้างโชว์ระหว่างรอโหลด
          this.devicesList = [];
          this.healthRecords = [];
          this.vaccineRecords = [];
          this.eggRecords = [];
          this.pendingVaccines = [];
          this.vaccineChecklist = [];
          this.manualAppointments = [];
          this.motionCount = 0;
          this.motionLastAt = null;
          this.selectedCoopName = null;
          this.buildSlots();
        }
        this.selectedCoop = params['coop'];
      }

      if (this.selectedCoop) {
        this.fetchCoopDetails();
        this.fetchPendingVaccines();
        this.fetchArrivalNote();
        this.fetchManualAppointments();
        this.fetchMotionAlerts();
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
    this.detailsInFlight?.unsubscribe();
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
    this.vaccineRecords = data?.vaccine_history || [];
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

    // เลขอุปกรณ์ (slot_index) เป็นเลขรันต่อคอก ไม่ใช่เลขช่องกริดอีกแล้ว - ใส่อุปกรณ์ลงช่องว่างเรียงตามเลข
    // ตำแหน่งที่แสดงใช้พิกัดที่บันทึกไว้ (ถ้ายังไม่มีใช้ตำแหน่งกริดเดิมตามเลข)
    [...this.devicesList]
      .sort((a, b) => (a.slot_index ?? 0) - (b.slot_index ?? 0))
      .slice(0, this.slots.length)
      .forEach((device, i) => {
        const slot = this.slots[i];
        slot.device = device;
        if (device.pos_x != null && device.pos_y != null) {
          slot.x = device.pos_x;
          slot.y = device.pos_y;
        } else {
          const fallback = legacyGridPosition(device.slot_index);
          if (fallback) {
            slot.x = fallback.x;
            slot.y = fallback.y;
          }
        }
      });
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
    // โพลอัตโนมัติข้ามรอบถ้าอันเก่ายังไม่ตอบ กัน request ซ้อน/ผลเก่าทับผลใหม่ ส่วน
    // การโหลดปกติ (เช่นเปลี่ยนคอก) ยกเลิกอันเก่าที่ค้างอยู่
    if (silent && this.detailsInFlight && !this.detailsInFlight.closed) return;
    this.detailsInFlight?.unsubscribe();
    if (!silent) this.isLoading = true;

    this.detailsInFlight = this.api.get<any>(`/coops?id=${this.selectedCoop}`).subscribe({
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

  // วัคซีนของคอกนี้ - คำนวณเดียวกับหน้า "ให้วัคซีน" (Give_vaccine) จาก response
  // เดียวกันนี้สร้าง 2 ลิสต์: pendingVaccines (เฉพาะที่ยังไม่ให้ - ใช้คำนวณนัดตรวจ
  // สุขภาพถัดไปเท่านั้น) และ vaccineChecklist (ทุกตัวรวมที่ให้แล้ว - โชว์ในกรอบ
  // "วัคซีนที่ให้")
  fetchArrivalNote() {
    if (!this.selectedCoop) return;
    loadArrivalVaccineNote(this.api, this.selectedCoop).subscribe(note => {
      this.arrivalNote = note;
      this.cdr.detectChanges();
    });
  }

  fetchPendingVaccines(silent = false) {
    if (!this.selectedCoop) return;
    this.api.get<any[]>('/vaccines/alerts').subscribe({
      next: (alerts) => {
        const today = new Date();
        const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        const mine = (alerts || []).filter(a => String(a?.coop_id) === String(this.selectedCoop) && a?.date);

        const toItem = (a: any) => {
          const d = new Date(a.date);
          const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          return {
            id: a.id,
            vaccineName: a.vaccine_name || 'วัคซีน',
            method: a.injection_type || '-',
            date: dateOnly,
            daysUntil: Math.round((dateOnly.getTime() - todayOnly.getTime()) / 86400000),
            isCompleted: a?.is_completed === true,
          };
        };

        this.vaccineChecklist = mine.map(toItem).sort((a, b) => a.date.getTime() - b.date.getTime());
        this.pendingVaccines = this.vaccineChecklist.filter(v => !v.isCompleted);
        if (!silent) this.cdr.detectChanges();
      },
      error: (err) => console.error('โหลดข้อมูลวัคซีนที่ต้องให้ไม่สำเร็จ:', err)
    });
  }

  // นัดตรวจสุขภาพที่กำหนดวันเองของคอกนี้ - ใช้ร่วมกับ pendingVaccines ใน
  // healthAppointment getter (ก่อนหน้านี้อ่านจาก localStorage ได้ทันทีแบบ sync แต่
  // ตอนนี้ต้องยิง API ก่อน จึง cache ผลไว้ในฟิลด์แทนที่จะคำนวณในตัว getter เอง)
  fetchManualAppointments(silent = false) {
    if (!this.selectedCoop) return;
    this.healthAppointmentService.list(Number(this.selectedCoop)).subscribe({
      next: (appts) => {
        this.manualAppointments = appts || [];
        if (!silent) this.cdr.detectChanges();
      },
      error: (err) => console.error('โหลดนัดตรวจที่กำหนดเองไม่สำเร็จ:', err)
    });
  }

  // ตรวจจับความเคลื่อนไหวที่วงกบประตู (เซนเซอร์ PIR) ของคอกนี้เท่านั้น - กรองจาก
  // รายการรวมทุกคอกของ /api/motion-alerts เอาเฉพาะ coop_id ตรงกับหน้านี้
  fetchMotionAlerts(silent = false) {
    if (!this.selectedCoop) return;
    this.api.get<any[]>('/motion-alerts').subscribe({
      next: (rows) => {
        const mine = (rows || []).filter(r => String(r?.coop_id) === String(this.selectedCoop));
        this.motionCount = mine.length;
        this.motionLastAt = mine.length
          ? mine.reduce((latest: Date, r: any) => {
              const t = new Date(r.timestamp);
              return !isNaN(t.getTime()) && t > latest ? t : latest;
            }, new Date(0))
          : null;
        if (!silent) this.cdr.detectChanges();
      },
      error: (err) => console.error('โหลดข้อมูลตรวจจับความเคลื่อนไหวไม่สำเร็จ:', err)
    });
  }

  get motionSummaryText(): string {
    if (this.motionCount === 0) return 'ยังไม่พบการเคลื่อนไหวหน้าคอก';
    const timeLabel = this.motionLastAt
      ? this.motionLastAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      : '-';
    return `ตรวจพบความเคลื่อนไหว ${this.motionCount} ครั้ง · ล่าสุด ${timeLabel}`;
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
        this.fetchManualAppointments(true);
        this.fetchMotionAlerts(true);
      });
    }
  }

  formatDate(date: Date | null): string {
    if (!date) return '-';
    return date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  get chickenAgeText(): string {
    return formatChickenAge(this.birthDate);
  }

  get deviceOnlineCount(): number {
    return this.devicesList.filter(d => d.current_status === 'Online').length;
  }

  // ข้อมูลกราฟไข่ที่เก็บได้ของคอกนี้ ย้อนหลัง 14 วัน (แสดงเป็นกราฟเส้น) (คล้ายหน้าเพิ่มไข่ แต่ย่อลง
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

  // กราฟเส้น: ความสูงจุด / เส้นโค้ง / พื้นใต้เส้น คำนวณด้วยตัวช่วยกลาง (shared/line-chart.util.ts)
  eggPointPercent(value: number): number {
    return linePointPercent(value, this.eggChartMax);
  }

  get eggLinePaths(): { line: string; area: string } {
    return smoothLinePaths(this.eggBars.map(b => b.value));
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

  get healthHistorySorted(): HealthRecord[] {
    return [...this.healthRecords].sort((a, b) => new Date(b.record_date).getTime() - new Date(a.record_date).getTime());
  }

  // นัดตรวจสุขภาพถัดไปของคอกนี้ - มีได้ 2 แหล่ง: วันก่อนวัคซีนที่ใกล้ครบกำหนดที่สุด 1
  // วัน (คำนวณเดียวกับ Add_health, ใช้ pendingVaccines ที่โหลดไว้แล้วไม่ต้องยิง API ซ้ำ)
  // หรือนัดที่กำหนดวันเองจากโหมด "นัดตรวจสุขภาพเอง" (ใช้ manualAppointments ที่โหลด
  // แคชไว้แล้วจาก backend - ตอนนี้เป็น async เลยอ่านสดในตัว getter ไม่ได้อีกต่อไป)
  get healthAppointment(): { appointmentDate: Date; vaccineName: string | null; vaccineDate: Date | null; isFuture: boolean } | null {
    const vaccineCandidates = this.pendingVaccines.map(v => {
      const appointmentDate = new Date(v.date);
      appointmentDate.setDate(appointmentDate.getDate() - 1);
      return { appointmentDate, vaccineName: v.vaccineName as string | null, vaccineDate: v.date as Date | null };
    });
    const manualCandidates = this.manualAppointments.map(m => ({
      appointmentDate: new Date(m.appointment_date),
      vaccineName: null as string | null,
      vaccineDate: null as Date | null,
    }));

    // วันที่มีผลตรวจสุขภาพจริงบันทึกไว้แล้ว - ตัดนัดที่ตรงกับวันนี้ทิ้ง กันไม่ให้
    // ขึ้น "ถึงกำหนดตรวจสุขภาพแล้ว" ค้างอยู่ทั้งที่ตรวจไปแล้วจริงๆ (เดิมคำนวณจากแค่
    // วันครบกำหนดวัคซีนเฉยๆ ไม่เคยเช็คกับ healthRecords เลย)
    const checkedDateKeys = new Set(
      this.healthRecords
        .map(r => new Date(r.record_date))
        .filter(d => !isNaN(d.getTime()))
        .map(d => formatDateKey(d))
    );

    // นัดที่กำหนดเองอยู่ก่อนวัคซีนในลิสต์ตั้งใจ - ถ้าวันที่ตรงกันเป๊ะ (sort เสถียร) นัด
    // ที่กำหนดเองจะ "ชนะ" แสดงเป็นนัดที่เรากำหนดเอง ไม่ใช่นัดจากวัคซีนซ้ำวันเดียวกัน
    const candidates = [...manualCandidates, ...vaccineCandidates]
      .filter(c => !checkedDateKeys.has(formatDateKey(c.appointmentDate)))
      .sort((a, b) => a.appointmentDate.getTime() - b.appointmentDate.getTime());
    if (candidates.length === 0) return null;

    const nearest = candidates[0];
    const today = new Date();
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // ถ้าวัคซีนหลายชนิดครบกำหนดวันเดียวกันพอดี (เลยต้องตรวจสุขภาพวันเดียวกันด้วย)
    // รวมชื่อวัคซีนทุกชนิดเป็นนัดเดียว ไม่ใช่โชว์แค่ตัวแรกที่สุ่มมาจาก sort เพราะ
    // ตรวจครั้งเดียวเอาผลไปใช้กับวัคซีนทุกชนิดที่ตรงวันนั้นได้เลย
    const nearestKey = formatDateKey(nearest.appointmentDate);
    const sameDate = vaccineCandidates.filter(c => formatDateKey(c.appointmentDate) === nearestKey);
    const combinedVaccineName = sameDate.length > 0
      ? sameDate.map(c => c.vaccineName).join('และ')
      : nearest.vaccineName;

    return {
      ...nearest,
      vaccineName: combinedVaccineName,
      isFuture: nearest.appointmentDate.getTime() > todayOnly.getTime(),
    };
  }

  formatDateObj(d: Date): string {
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // แยก "ถึงกำหนดวันนี้พอดี" ออกจาก "เลยกำหนดมาแล้ว" - isFuture เฉยๆ บอกได้แค่
  // "ถึงกำหนดแล้วหรือยัง" ไม่บอกว่าคือวันนี้เป๊ะหรือเลยมาหลายวันแล้ว ทำให้ข้อความ
  // เดิมดูเหมือนแจ้งเตือนลอยๆ ไม่บอกว่า "วันนี้" ต้องตรวจ
  isAppointmentToday(appointmentDate: Date): boolean {
    const today = new Date();
    return (
      appointmentDate.getFullYear() === today.getFullYear() &&
      appointmentDate.getMonth() === today.getMonth() &&
      appointmentDate.getDate() === today.getDate()
    );
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

  // เหมือน vaccineStatusLabel/vaccineStatusClass แต่เช็คสถานะ "สำเร็จแล้ว" ก่อน
  // (ใช้กับ vaccineChecklist ที่มีทั้งตัวที่ให้แล้วและยังไม่ได้ให้ปนกัน)
  vaccineChecklistStatusLabel(v: VaccineChecklistItem): string {
    return v.isCompleted ? 'สำเร็จแล้ว' : this.vaccineStatusLabel(v);
  }

  vaccineChecklistStatusClass(v: VaccineChecklistItem): string {
    return v.isCompleted ? 'is-done' : this.vaccineStatusClass(v);
  }

  // ป็อบอัพซ้อนทับหน้านี้ - ฝังหน้าเดิม (ที่เคยเป็นปุ่มพาไปหน้าอื่น) ไว้ในกรอบ ไม่ต้องออกจากหน้า
  // ข้อมูลคอก: จัดวางเซนเซอร์ / ดูสถานะอุปกรณ์ / บันทึกไข่ / ตรวจสุขภาพ / ให้วัคซีน
  devicePopup: 'setup' | 'status' | 'egg' | 'health' | 'vaccine' | null = null;
  popupInjector: Injector | null = null;

  private static readonly POPUP_TITLES: Record<string, string> = {
    setup: 'จัดวางเซนเซอร์',
    status: 'สถานะเซนเซอร์',
    egg: 'บันทึกไข่',
    health: 'ตรวจสุขภาพ',
    vaccine: 'ให้วัคซีน',
  };

  get popupTitle(): string {
    return this.devicePopup ? DataCoopComponent.POPUP_TITLES[this.devicePopup] : '';
  }

  // หน้าบันทึกไข่/ตรวจสุขภาพ/ให้วัคซีนอ่านคอกจาก URL (?coop_id=) และตอนบันทึกเสร็จบางหน้าสั่ง
  // Location.back() - ในป็อบอัพไม่มี URL ให้อ่านและห้ามถอยหน้าเบราว์เซอร์ จึงสร้าง injector
  // ที่ส่งค่า coop_id ให้เอง และให้ back() = ปิดป็อบอัพแทน
  get popupComponent(): Type<unknown> | null {
    switch (this.devicePopup) {
      case 'egg': return AddEggComponent;
      case 'health': return AddHealthComponent;
      case 'vaccine': return GiveVaccineComponent;
      default: return null;
    }
  }

  openDevicePopup(kind: 'setup' | 'status' | 'egg' | 'health' | 'vaccine') {
    this.devicePopup = kind;
    if (kind === 'egg' || kind === 'health' || kind === 'vaccine') {
      const params = convertToParamMap({ coop_id: String(this.selectedCoop) });
      const fakeRoute = { snapshot: { queryParamMap: params, queryParams: { coop_id: String(this.selectedCoop) } }, queryParamMap: of(params), queryParams: of({ coop_id: String(this.selectedCoop) }) };
      const fakeLocation = { back: () => this.closeDevicePopup() };
      this.popupInjector = Injector.create({
        parent: this.injector,
        providers: [
          { provide: ActivatedRoute, useValue: fakeRoute as unknown as ActivatedRoute },
          { provide: Location, useValue: fakeLocation as unknown as Location },
        ],
      });
    } else {
      this.popupInjector = null;
    }
    this.cdr.detectChanges();
  }

  // ปิดป็อบอัพแล้วโหลดข้อมูลคอกใหม่ (ไข่/สุขภาพ/วัคซีน/อุปกรณ์ที่เพิ่งบันทึกในป็อบอัพจะขึ้นในหน้านี้ทันที)
  closeDevicePopup() {
    this.devicePopup = null;
    this.popupInjector = null;
    this.fetchCoopDetails();
    this.cdr.detectChanges();
  }

  // บันทึกผังอุปกรณ์แล้ว - ปิดป็อบอัพ (และโหลดข้อมูลคอกใหม่)
  onDevicesSaved() {
    this.closeDevicePopup();
  }

}
