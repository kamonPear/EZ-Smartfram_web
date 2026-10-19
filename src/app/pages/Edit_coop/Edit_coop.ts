import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Device, EggRecord, HealthRecord, VaccineRecord, toBackendDateOnly, formatChickenAge } from '../../shared/coop-summary.util';
import { DatePickerCalendar } from '../../shared/date-picker-calendar/date-picker-calendar';
import { DayMarker, loadCalendarMarkers } from '../../shared/calendar-markers.util';
import { deviceIconSrc } from '../../shared/device-icon.util';
import { SetUpSystem } from '../Set_up_System/Set_up_System';
import { ConfirmService, changedLines, thDate } from '../../services/confirm.service';

type RecordKind = 'health' | 'vaccine' | 'egg';

const VACCINE_METHODS = ['พ่น', 'ฉีด', 'หยอดปาก', 'ผสมน้ำ', 'ผสมอาหาร'];

@Component({
  selector: 'app-edit-coop',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, DatePickerCalendar, SetUpSystem],
  templateUrl: './Edit_coop.html',
  styleUrls: ['./Edit_coop.scss']
})
export class EditCoopComponent implements OnInit {
  private confirm = inject(ConfirmService);

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

  // ค่าเดิมตอนโหลดหน้า / ตอนเปิดหน้าต่างแก้ไขรายการ - ใช้เทียบว่าแก้ช่องไหนไป
  // เพื่อโชว์ในป็อบอัพยืนยันก่อนบันทึก (ค่าเดิม → ค่าใหม่)
  private originalCoop: { name: string; count: number | null; birth: Date | null; received: Date | null; note: string } | null = null;
  private editingOriginal: HealthRecord | VaccineRecord | EggRecord | null = null;
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
        this.originalCoop = { name: this.coopName, count: this.chickenCount, birth: this.birthDate, received: this.receivedDate, note: this.note };
        this.devices = data?.devices || [];
        // วันล่าสุดขึ้นก่อน วันเก่าไปอยู่ล่างสุด (เดิมไม่ได้เรียงเลย ใช้ลำดับดิบจาก
        // backend ซึ่งไม่จำเป็นต้องเรียงตามวันที่)
        this.healthRecords = [...(data?.health || [])].sort((a, b) => new Date(b.record_date).getTime() - new Date(a.record_date).getTime());
        this.vaccineRecords = [...(data?.vaccine_history || [])].sort((a, b) => new Date(b.record_date).getTime() - new Date(a.record_date).getTime());
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

  // ป็อบอัพจัดการอุปกรณ์ - ซ้อนทับหน้านี้ ใช้หน้าจัดวางระบบเซนเซอร์ตัวเดียวกับหน้า /setup
  // ไม่ต้องออกจากหน้าแก้ไขคอก
  showDeviceManager = false;

  openDeviceManager() {
    this.showDeviceManager = true;
    this.cdr.detectChanges();
  }

  closeDeviceManager() {
    this.showDeviceManager = false;
    this.cdr.detectChanges();
  }

  // บันทึกผังอุปกรณ์แล้ว - ปิดป็อบอัพ และโหลดรายการอุปกรณ์ของคอกนี้ใหม่ให้ตรงกับที่เพิ่งบันทึก
  onDevicesSaved() {
    this.showDeviceManager = false;
    this.loadCoop();
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

  get birthDateAgeText(): string {
    return formatChickenAge(this.birthDate);
  }

  // วันที่รับเข้าเลี้ยงต้องไม่ก่อนวันเกิดไก่ (เอาไก่เข้าคอกก่อนไก่เกิดไม่ได้อยู่แล้ว)
  // เทียบแค่ระดับวัน ไม่สนเวลา เผื่อ Date object มีเวลาปนมาจากไหนก็ตาม
  get isReceivedBeforeBirth(): boolean {
    if (!this.birthDate || !this.receivedDate) return false;
    const birth = new Date(this.birthDate.getFullYear(), this.birthDate.getMonth(), this.birthDate.getDate());
    const received = new Date(this.receivedDate.getFullYear(), this.receivedDate.getMonth(), this.receivedDate.getDate());
    return received.getTime() < birth.getTime();
  }

  async saveCoop() {
    if (!this.coopName.trim() || !this.chickenCount || this.chickenCount < 1 || !this.birthDate || !this.receivedDate) {
      alert('กรุณากรอกชื่อคอก จำนวนไก่ วันเกิดไก่ และวันที่รับเข้าเลี้ยงให้ครบถ้วน');
      return;
    }

    if (this.isReceivedBeforeBirth) {
      alert('วันที่รับเข้าเลี้ยงต้องไม่ก่อนวันเกิดไก่ (เอาไก่เข้าคอกก่อนไก่เกิดไม่ได้)');
      return;
    }

    // ให้เจ้าของฟาร์มทวนข้อมูลอีกรอบก่อนบันทึกจริง (ป็อบอัพกลาง services/confirm.service.ts)
    // โชว์เฉพาะช่องที่แก้ไขจริง (ค่าเดิม → ค่าใหม่) ให้เจ้าของฟาร์มเช็กอีกรอบ
    const o = this.originalCoop;
    const changes = changedLines([
      ['ชื่อคอก', o?.name, this.coopName],
      ['จำนวนไก่', o?.count != null ? `${o.count} ตัว` : null, this.chickenCount != null ? `${this.chickenCount} ตัว` : null],
      ['วันเกิดไก่', thDate(o?.birth), thDate(this.birthDate)],
      ['วันที่รับเข้าเลี้ยง', thDate(o?.received), thDate(this.receivedDate)],
      ['หมายเหตุ', o?.note, this.note],
    ]);
    if (changes.length === 0) {
      alert('ยังไม่ได้แก้ไขข้อมูลใด ๆ');
      return;
    }
    const ok = await this.confirm.ask({
      message: `ตรวจสอบรายการที่แก้ไข (${changes.length} รายการ) ก่อนบันทึก`,
      details: changes,
    });
    if (!ok) return;
    this.isSaving = true;

    const payload = {
      name_coop: this.coopName.trim(),
      amount: this.chickenCount,
      birthday: toBackendDateOnly(this.birthDate),
      date_adopt_animals: toBackendDateOnly(this.receivedDate),
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
      this.editingOriginal = r;
    } else if (kind === 'vaccine') {
      const r = record as VaccineRecord;
      this.editingRecordId = r.vaccine_id;
      this.recordDate = new Date(r.record_date);
      this.vaccineForm = { name: r.name, method: r.method || '', recommendedAge: r.recommended_age || '', note: r.note || '' };
      this.editingOriginal = r;
    } else {
      const r = record as EggRecord;
      this.editingRecordId = r.egg_id;
      this.recordDate = new Date(r.date_collect_egg);
      this.eggForm = { numberEgg: r.number_egg, note: r.note || '' };
      this.editingOriginal = r;
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
        record_date: toBackendDateOnly(this.recordDate)
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
        record_date: toBackendDateOnly(this.recordDate)
      };
      this.submitRecord('vaccine', '/vaccines', payload);
    } else if (this.openRecordModal === 'egg') {
      // ไม่กรอกจำนวนไข่ (ช่องว่าง) = คงค่าเดิม ไม่ส่ง number_egg ไป backend จะไม่แตะค่านี้
      // แต่ถ้ากรอกมาแล้วต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป
      const rawCount = this.eggForm.numberEgg as number | string | null;
      const keepOriginal = rawCount === null || rawCount === undefined || rawCount === '';
      if (!keepOriginal && (!Number.isInteger(Number(rawCount)) || Number(rawCount) < 1)) {
        alert('กรุณากรอกจำนวนไข่ให้ถูกต้อง');
        return;
      }
      const payload: any = {
        coop_id: Number(this.coopId),
        note: this.eggForm.note,
        date_collect_egg: toBackendDateOnly(this.recordDate)
      };
      if (!keepOriginal) payload.number_egg = Number(rawCount);
      this.submitRecord('egg', '/eggs', payload);
    }
  }

  private async submitRecord(kind: RecordKind, basePath: string, payload: any) {
    // ให้เจ้าของฟาร์มทวนข้อมูลอีกรอบก่อนบันทึกจริง (ป็อบอัพกลาง services/confirm.service.ts)
    const what = kind === 'health' ? 'ผลตรวจสุขภาพ' : kind === 'vaccine' ? 'ประวัติการให้วัคซีน' : 'บันทึกการเก็บไข่';
    // โชว์เฉพาะช่องที่แก้ไขจริง (ค่าเดิม → ค่าใหม่)
    const orig: any = this.editingOriginal || {};
    const rows: [string, unknown, unknown][] =
      kind === 'health' ? [
        ['วันที่ตรวจ', thDate(orig.record_date), thDate(payload.record_date)],
        ['ไก่สุขภาพดี', `${orig.healthy} ตัว`, `${payload.healthy} ตัว`],
        ['ไก่ป่วย', `${orig.poor_health} ตัว`, `${payload.poor_health} ตัว`],
        ['หมายเหตุ', orig.note, payload.note],
      ] : kind === 'vaccine' ? [
        ['วันที่ให้วัคซีน', thDate(orig.record_date), thDate(payload.record_date)],
        ['ชื่อวัคซีน', orig.name, payload.name],
        ['วิธีการให้', orig.method, payload.method],
        ['อายุไก่ที่ให้', orig.recommended_age, payload.recommended_age],
        ['หมายเหตุ', orig.note, payload.note],
      ] : [
        ['วันที่เก็บไข่', thDate(orig.date_collect_egg), thDate(payload.date_collect_egg)],
        ['จำนวนไข่', `${orig.number_egg} ฟอง`, `${payload.number_egg ?? orig.number_egg} ฟอง`],
        ['หมายเหตุ', orig.note, payload.note],
      ];
    const changes = changedLines(rows);
    if (changes.length === 0) {
      alert('ยังไม่ได้แก้ไขข้อมูลใด ๆ');
      return;
    }
    if (!(await this.confirm.ask({ message: `ตรวจสอบรายการที่แก้ไขใน${what} (${changes.length} รายการ) ก่อนบันทึก`, details: changes }))) return;
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
