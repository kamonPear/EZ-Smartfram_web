import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Device, EggRecord, HealthRecord, VaccineRecord } from '../../shared/coop-summary.util';

type RecordKind = 'health' | 'vaccine' | 'egg';

const VACCINE_METHODS = ['พ่น', 'ฉีด', 'หยอดปาก', 'ผสมน้ำ', 'ผสมอาหาร'];

@Component({
  selector: 'app-edit-coop',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './Edit_coop.html',
  styleUrls: ['./Edit_coop.scss']
})
export class EditCoopComponent implements OnInit {

  weekDayLabels = ['MON', 'TUES', 'WEDNES', 'THURS', 'FRI', 'SATUR', 'SUN'];
  vaccineMethods = VACCINE_METHODS;

  currentDate = new Date();
  calendarWeeks: (Date | null)[][] = [];

  coopId: string | null = null;
  isLoading = true;
  isSaving = false;

  coopName: string = '';
  chickenCount: number | null = null;
  birthDate: Date | null = null;
  note: string = '';
  receivedDate: Date | null = null;

  devices: Device[] = [];
  healthRecords: HealthRecord[] = [];
  vaccineRecords: VaccineRecord[] = [];
  eggRecords: EggRecord[] = [];

  activeField: 'birth' | 'received' | 'record' | null = null;
  recordDate: Date | null = null;

  openRecordModal: RecordKind | null = null;
  editingRecordId: number | null = null;
  isSavingRecord = false;

  healthForm = { healthy: null as number | null, poorHealth: null as number | null, note: '' };
  vaccineForm = { name: '', method: '', recommendedAge: '', note: '' };
  eggForm = { numberEgg: null as number | null, note: '' };

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {
    this.buildCalendar();
  }

  ngOnInit(): void {
    this.coopId = this.route.snapshot.queryParamMap.get('id');
    if (!this.coopId) {
      alert('ไม่พบคอกที่ต้องการแก้ไข');
      this.router.navigate(['/home']);
      return;
    }
    this.loadCoop();
  }

  loadCoop() {
    this.isLoading = true;
    this.api.get<any>(`/coops?id=${this.coopId}`).subscribe({
      next: (data) => {
        this.coopName = data?.name_coop || '';
        this.chickenCount = data?.amount ?? null;
        this.birthDate = data?.birthday ? new Date(data.birthday) : null;
        this.receivedDate = data?.date_adopt_animals ? new Date(data.date_adopt_animals) : null;
        this.note = data?.note || '';
        this.devices = data?.devices || [];
        this.healthRecords = data?.health || [];
        this.vaccineRecords = data?.vaccines || [];
        this.eggRecords = data?.eggs || [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('ดึงข้อมูลคอกล้มเหลว:', err);
        alert('ไม่พบข้อมูลคอกนี้');
        this.router.navigate(['/home']);
      }
    });
  }

  goToSetup() {
    this.router.navigate(['/setup'], { queryParams: { coop: this.coopId } });
  }

  get monthLabel(): string {
    return this.currentDate.toLocaleString('en-US', { month: 'long' }).toUpperCase()
      + ' ' + this.currentDate.getFullYear();
  }

  buildCalendar() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7; // ให้วันจันทร์เป็นคอลัมน์แรก
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    this.calendarWeeks = weeks;
  }

  prevMonth() {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
    this.buildCalendar();
  }

  nextMonth() {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
    this.buildCalendar();
  }

  selectDateField(field: 'birth' | 'received') {
    this.currentDate = (field === 'birth' ? this.birthDate : this.receivedDate) || new Date();
    this.buildCalendar();
    this.activeField = field;
  }

  openRecordCalendar() {
    this.currentDate = this.recordDate || new Date();
    this.buildCalendar();
    this.activeField = 'record';
  }

  closeCalendar() {
    this.activeField = null;
  }

  selectDay(day: Date | null) {
    if (!day) return;
    if (this.activeField === 'birth') {
      this.birthDate = day;
    } else if (this.activeField === 'received') {
      this.receivedDate = day;
    } else if (this.activeField === 'record') {
      this.recordDate = day;
    }
    this.activeField = null;
  }

  isSelected(day: Date | null): boolean {
    if (!day || !this.activeField) return false;
    const target = this.activeField === 'received' ? this.receivedDate
      : this.activeField === 'record' ? this.recordDate
      : this.birthDate;
    return !!target && day.toDateString() === target.toDateString();
  }

  isToday(day: Date | null): boolean {
    return !!day && day.toDateString() === new Date().toDateString();
  }

  formatDate(date: Date | null): string {
    if (!date) return '';
    return date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatIsoDate(iso: string | null | undefined): string {
    if (!iso) return '';
    return this.formatDate(new Date(iso));
  }

  saveCoop() {
    if (!this.coopName.trim() || !this.chickenCount || this.chickenCount < 1 || !this.birthDate || !this.receivedDate) {
      alert('กรุณากรอกชื่อคอก จำนวนไก่ วันเกิดไก่ และวันที่รับเข้าเลี้ยงให้ครบถ้วน');
      return;
    }

    this.isSaving = true;

    const payload = {
      name_coop: this.coopName.trim(),
      amount: this.chickenCount,
      birthday: this.birthDate.toISOString(),
      date_adopt_animals: this.receivedDate.toISOString(),
      note: this.note
    };

    this.api.put(`/coops?id=${this.coopId}`, payload).subscribe({
      next: () => this.router.navigate(['/home']),
      error: (err: any) => {
        this.isSaving = false;
        console.error('บันทึกการแก้ไขไม่สำเร็จ:', err);
        if (err.status === 409) {
          alert('ชื่อคอกนี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น');
        } else {
          alert('บันทึกการแก้ไขไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        }
        this.cdr.detectChanges();
      }
    });
  }

  // ---------- Health / Vaccine / Egg record modal ----------

  openAddRecord(kind: RecordKind) {
    this.openRecordModal = kind;
    this.editingRecordId = null;
    this.recordDate = new Date();
    if (kind === 'health') this.healthForm = { healthy: null, poorHealth: null, note: '' };
    if (kind === 'vaccine') this.vaccineForm = { name: '', method: '', recommendedAge: '', note: '' };
    if (kind === 'egg') this.eggForm = { numberEgg: null, note: '' };
  }

  openEditRecord(kind: RecordKind, record: HealthRecord | VaccineRecord | EggRecord) {
    this.openRecordModal = kind;
    if (kind === 'health') {
      const r = record as HealthRecord;
      this.editingRecordId = r.health_id;
      this.recordDate = new Date(r.record_date);
      this.healthForm = { healthy: r.healthy, poorHealth: r.poor_health, note: r.note || '' };
    } else if (kind === 'vaccine') {
      const r = record as VaccineRecord;
      this.editingRecordId = r.vaccine_id;
      this.recordDate = new Date(r.record_date);
      this.vaccineForm = { name: r.name, method: r.method || '', recommendedAge: r.recommended_age || '', note: r.note || '' };
    } else {
      const r = record as EggRecord;
      this.editingRecordId = r.egg_id;
      this.recordDate = new Date(r.date_collect_egg);
      this.eggForm = { numberEgg: r.number_egg, note: r.note || '' };
    }
  }

  closeRecordModal() {
    this.openRecordModal = null;
    this.editingRecordId = null;
  }

  saveRecord() {
    if (!this.recordDate) {
      alert('กรุณาเลือกวันที่บันทึก');
      return;
    }

    if (this.openRecordModal === 'health') {
      if (this.healthForm.healthy == null || this.healthForm.poorHealth == null) {
        alert('กรุณากรอกจำนวนไก่สุขภาพดีและป่วยให้ครบถ้วน');
        return;
      }
      const payload = {
        coop_id: Number(this.coopId),
        healthy: this.healthForm.healthy,
        poor_health: this.healthForm.poorHealth,
        note: this.healthForm.note,
        record_date: this.recordDate.toISOString()
      };
      this.submitRecord('health', '/healths', payload);
    } else if (this.openRecordModal === 'vaccine') {
      if (!this.vaccineForm.name.trim() || !this.vaccineForm.method) {
        alert('กรุณากรอกชื่อวัคซีนและวิธีให้ยาให้ครบถ้วน');
        return;
      }
      const payload = {
        coop_id: Number(this.coopId),
        name: this.vaccineForm.name.trim(),
        method: this.vaccineForm.method,
        recommended_age: this.vaccineForm.recommendedAge,
        note: this.vaccineForm.note,
        record_date: this.recordDate.toISOString()
      };
      this.submitRecord('vaccine', '/vaccines', payload);
    } else if (this.openRecordModal === 'egg') {
      if (!this.eggForm.numberEgg || this.eggForm.numberEgg < 1) {
        alert('กรุณากรอกจำนวนไข่ให้ถูกต้อง');
        return;
      }
      const payload = {
        coop_id: Number(this.coopId),
        number_egg: this.eggForm.numberEgg,
        note: this.eggForm.note,
        date_collect_egg: this.recordDate.toISOString()
      };
      this.submitRecord('egg', '/eggs', payload);
    }
  }

  private submitRecord(kind: RecordKind, basePath: string, payload: any) {
    this.isSavingRecord = true;
    const req$ = this.editingRecordId != null
      ? this.api.put(`${basePath}?id=${this.editingRecordId}`, payload)
      : this.api.post(basePath, payload);

    req$.subscribe({
      next: () => {
        this.isSavingRecord = false;
        this.closeRecordModal();
        this.loadCoop();
      },
      error: (err: any) => {
        this.isSavingRecord = false;
        console.error(`บันทึกข้อมูล${kind}ไม่สำเร็จ:`, err);
        alert('บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        this.cdr.detectChanges();
      }
    });
  }

}
