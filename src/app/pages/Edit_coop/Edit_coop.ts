import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Device, EggRecord, HealthRecord, VaccineRecord } from '../../shared/coop-summary.util';
import { DatePickerCalendar } from '../../shared/date-picker-calendar/date-picker-calendar';
import { DayMarker, loadCalendarMarkers } from '../../shared/calendar-markers.util';
import { deviceIconSrc } from '../../shared/device-icon.util';

type RecordKind = 'health' | 'vaccine' | 'egg';

const VACCINE_METHODS = ['พ่น', 'ฉีด', 'หยอดปาก', 'ผสมน้ำ', 'ผสมอาหาร'];

@Component({
  selector: 'app-edit-coop',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, DatePickerCalendar],
  templateUrl: './Edit_coop.html',
  styleUrls: ['./Edit_coop.scss']
})
export class EditCoopComponent implements OnInit {

  deviceIconSrc = deviceIconSrc;
  vaccineMethods = VACCINE_METHODS;
  dayMarkers: Map<string, DayMarker> | null = null;

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
  ) {}

  ngOnInit(): void {
    this.coopId = this.route.snapshot.queryParamMap.get('id');
    if (!this.coopId) {
      alert('ไม่พบคอกที่ต้องการแก้ไข');
      this.router.navigate(['/home']);
      return;
    }
    this.loadCoop();
    loadCalendarMarkers(this.api, Number(this.coopId)).subscribe({
      next: (markers) => this.dayMarkers = markers,
      error: (err) => console.error('โหลดข้อมูลมาร์คปฏิทินไม่สำเร็จ:', err)
    });
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
        // วันล่าสุดขึ้นก่อน วันเก่าไปอยู่ล่างสุด (เดิมไม่ได้เรียงเลย ใช้ลำดับดิบจาก
        // backend ซึ่งไม่จำเป็นต้องเรียงตามวันที่)
        this.healthRecords = [...(data?.health || [])].sort((a, b) => new Date(b.record_date).getTime() - new Date(a.record_date).getTime());
        this.vaccineRecords = [...(data?.vaccines || [])].sort((a, b) => new Date(b.record_date).getTime() - new Date(a.record_date).getTime());
        this.eggRecords = [...(data?.eggs || [])].sort((a, b) => new Date(b.date_collect_egg).getTime() - new Date(a.date_collect_egg).getTime());
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

  selectDateField(field: 'birth' | 'received') {
    this.activeField = field;
    this.cdr.detectChanges();
  }

  openRecordCalendar() {
    this.activeField = 'record';
    this.cdr.detectChanges();
  }

  closeCalendar() {
    this.activeField = null;
    this.cdr.detectChanges();
  }

  get activeFieldDate(): Date | null {
    if (this.activeField === 'received') return this.receivedDate;
    if (this.activeField === 'record') return this.recordDate;
    return this.birthDate;
  }

  onDaySelected(day: Date) {
    if (this.activeField === 'birth') {
      this.birthDate = day;
    } else if (this.activeField === 'received') {
      this.receivedDate = day;
    } else if (this.activeField === 'record') {
      this.recordDate = day;
    }
    this.activeField = null;
    this.cdr.detectChanges();
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
  // หน้านี้คือ "แก้ไข" ข้อมูลคอกเท่านั้น - การเพิ่มบันทึกใหม่ย้ายไปอยู่ที่หน้า
  // "ข้อมูลคอกไก่" (ปุ่มตรวจสุขภาพ/ให้วัคซีน/บันทึกไข่) แทนแล้ว โมดัลนี้จึงเปิด
  // จาก openEditRecord() เท่านั้น ไม่มี openAddRecord() อีก

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
    this.cdr.detectChanges();
  }

  closeRecordModal() {
    this.openRecordModal = null;
    this.editingRecordId = null;
    this.cdr.detectChanges();
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
    this.api.put(`${basePath}?id=${this.editingRecordId}`, payload).subscribe({
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
