import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { DatePickerCalendar } from '../../shared/date-picker-calendar/date-picker-calendar';
import { DayMarker, formatDateKey, loadCalendarMarkers } from '../../shared/calendar-markers.util';
import { HealthAppointmentService, HealthAppointment } from '../../services/health-appointment.service';
import { Coop } from '../../shared/coop-summary.util';

type Mode = 'auto' | 'manual';

interface Appointment {
  coopId: string;
  coopName: string;
  appointmentDate: Date;
  vaccineName: string;
  vaccineDate: Date;
  daysUntil: number;
}

// รายการนัดตรวจของคอกที่เลือกไว้ในโหมด "กำหนดเอง" - รวม 2 แหล่งเข้าด้วยกัน:
// นัดที่คำนวณอัตโนมัติจากวัคซีน (kind: 'auto', ยังไม่ถูกบันทึกจริง) และนัดที่
// ตั้งเองแล้วบันทึกไว้ที่ backend (kind: 'manual') เรียงตามวันที่ กดรายการไหน
// ก็เปิดปฏิทินให้เปลี่ยนวันที่ของรายการนั้นได้เลย
interface CoopAppointmentItem {
  kind: 'auto' | 'manual';
  date: Date;
  title: string;
  sub: string;
  manual?: HealthAppointment;
}

// หน้า "นัดตรวจสุขภาพ" รวมทั้งฟาร์ม - มี 2 โหมด:
// - อัตโนมัติ: คำนวณจากวันครบกำหนดวัคซีนของแต่ละคอก (ตรวจก่อนให้วัคซีน 1 วันเสมอ
//   เพื่อคัดเฉพาะไก่แข็งแรง) เหมือนแอปมือถือ (MainHealthAppointments)
// - กำหนดเอง: เลือกคอก แล้วเห็นรายการวันนัดตรวจของคอกนั้นทั้งหมด (จากวัคซีน+ที่
//   ตั้งเอง) เป็นลิสต์ กดรายการไหนก็เปลี่ยนวันที่ของรายการนั้นได้ หรือกด "เพิ่มนัด
//   ใหม่" เพื่อเพิ่มนัดที่ไม่ได้มาจากวัคซีนก็ได้
@Component({
  selector: 'app-health-appointments',
  standalone: true,
  imports: [CommonModule, RouterModule, DatePickerCalendar],
  templateUrl: './Health_appointments.html',
  styleUrls: ['./Health_appointments.scss']
})
export class HealthAppointmentsComponent {
  mode: Mode = 'auto';
  isLoading = true;
  appointments: Appointment[] = [];

  coops: Coop[] = [];
  manualCoopId: number | null = null;
  isCalendarOpen = false;
  // รายการที่กำลังถูกกด "เปลี่ยนวันที่" อยู่ (เปิดปฏิทินค้างรออยู่) - null แปลว่า
  // กำลังจะ "เพิ่มนัดใหม่" แทนที่จะเปลี่ยนของเดิม
  reschedulingItem: CoopAppointmentItem | null = null;
  // วันที่เพิ่งกดเลือกจากปฏิทิน แต่ยังไม่บันทึกจริง - รอผู้ใช้กดยืนยันในป็อบอัพ
  // ถัดไปก่อน (กันกดวันผิดโดยไม่ตั้งใจ) ถ้ากดยกเลิก ทิ้งค่านี้ไปเฉยๆ ไม่บันทึกอะไร
  pendingDay: Date | null = null;
  showConfirmDialog = false;
  // มาร์คปฏิทิน (จุดสี) ของคอกที่เลือกไว้ - ให้เห็นว่าวันไหนมีรายการอะไรอยู่แล้ว
  // ตอนเปิดปฏิทินเลือกวันที่ ไม่ใช่ปฏิทินเปล่าๆ
  dayMarkers: Map<string, DayMarker> | null = null;
  // รายการนัดที่กำหนดเองทั้งหมด (ทุกคอก) - โหลดจาก backend ไว้เพื่อกรองเฉพาะของ
  // คอกที่เลือกมาผสมกับนัดอัตโนมัติใน coopAppointmentItems
  manualAppointments: HealthAppointment[] = [];

  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  constructor(
    private router: Router,
    private api: ApiService,
    private healthAppointmentService: HealthAppointmentService,
    private cdr: ChangeDetectorRef
  ) {
    this.fetchAppointments();
    this.loadCoops();
    this.loadManualAppointments();
  }

  setMode(mode: Mode) {
    this.mode = mode;
  }

  loadCoops() {
    this.api.get<Coop[]>('/coops').subscribe({
      next: (coops) => {
        this.coops = coops || [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('โหลดรายชื่อคอกไม่สำเร็จ:', err);
        this.cdr.detectChanges();
      }
    });
  }

  loadManualAppointments() {
    this.healthAppointmentService.list(null).subscribe({
      next: (appts) => {
        this.manualAppointments = [...(appts || [])].sort(
          (a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime()
        );
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('โหลดนัดตรวจที่กำหนดเองไม่สำเร็จ:', err);
        this.cdr.detectChanges();
      }
    });
  }

  fetchAppointments() {
    this.isLoading = true;
    forkJoin({
      coops: this.api.get<any[]>('/coops'),
      alerts: this.api.get<any[]>('/vaccines/alerts'),
    }).subscribe({
      next: ({ coops, alerts }) => {
        const coopNames = new Map<string, string>();
        for (const c of coops || []) {
          const id = String(c?.coop_id ?? '');
          coopNames.set(id, (c?.name_coop && String(c.name_coop).trim()) || `คอก ${id}`);
        }

        const today = new Date();
        const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        const list: Appointment[] = [];
        for (const a of alerts || []) {
          if (a?.is_completed === true) continue;
          if (!a?.date) continue;
          const vaccineDate = new Date(a.date);
          if (isNaN(vaccineDate.getTime())) continue;
          const vaccineDateOnly = new Date(vaccineDate.getFullYear(), vaccineDate.getMonth(), vaccineDate.getDate());
          const appointmentDate = new Date(vaccineDateOnly);
          appointmentDate.setDate(appointmentDate.getDate() - 1);
          const coopId = String(a?.coop_id ?? '-');

          list.push({
            coopId,
            coopName: coopNames.get(coopId) || `คอก ${coopId}`,
            appointmentDate,
            vaccineName: a?.vaccine_name || 'วัคซีน',
            vaccineDate: vaccineDateOnly,
            daysUntil: Math.round((appointmentDate.getTime() - todayOnly.getTime()) / 86400000),
          });
        }

        list.sort((x, y) => x.appointmentDate.getTime() - y.appointmentDate.getTime());
        this.appointments = list;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('โหลดข้อมูลนัดตรวจไม่สำเร็จ:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  statusLabel(a: Appointment): string {
    if (a.daysUntil < 0) return `เลยกำหนดมา ${-a.daysUntil} วัน`;
    if (a.daysUntil === 0) return 'นัดวันนี้';
    if (a.daysUntil === 1) return 'นัดพรุ่งนี้';
    return `อีก ${a.daysUntil} วัน`;
  }

  statusClass(a: Appointment): string {
    if (a.daysUntil <= 0) return 'is-danger';
    if (a.daysUntil === 1) return 'is-warning';
    return 'is-ok';
  }

  openAppointment(a: Appointment) {
    this.router.navigate(['/add-health'], {
      queryParams: { coop_id: a.coopId, date: formatDateKey(a.appointmentDate) }
    });
  }

  selectManualCoop(coop: Coop) {
    this.manualCoopId = coop.coop_id;
    this.loadCoopMarkers();
    this.cdr.detectChanges();
  }

  // มาร์คจุดสีของคอกที่เลือก (วัคซีน/ตรวจสุขภาพ/วันเกิด/นัดที่ตั้งเอง) ใช้โชว์ใน
  // ปฏิทินตอนเลือกวันที่ ให้เห็นว่าวันไหนมีรายการอะไรอยู่แล้วก่อนเลือกทับ
  loadCoopMarkers() {
    if (this.manualCoopId == null) {
      this.dayMarkers = null;
      return;
    }
    loadCalendarMarkers(this.api, this.manualCoopId).subscribe({
      next: (markers) => {
        this.dayMarkers = markers;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('โหลดมาร์คปฏิทินของคอกไม่สำเร็จ:', err),
    });
  }

  closeCoopAppointmentModal() {
    this.manualCoopId = null;
    this.cdr.detectChanges();
  }

  get selectedManualCoopName(): string {
    const coop = this.coops.find(c => c.coop_id === this.manualCoopId);
    return coop ? coop.name_coop : '';
  }

  // นัดตรวจทั้งหมดของคอกที่เลือก (อัตโนมัติจากวัคซีน + ที่ตั้งเองไว้แล้ว) เรียง
  // ตามวันที่ใกล้สุดก่อน - กดรายการไหนในลิสต์นี้ก็เปลี่ยนวันที่ของรายการนั้นได้
  get coopAppointmentItems(): CoopAppointmentItem[] {
    if (this.manualCoopId == null) return [];
    const coopIdStr = String(this.manualCoopId);
    const items: CoopAppointmentItem[] = [];

    for (const a of this.appointments) {
      if (a.coopId !== coopIdStr) continue;
      items.push({
        kind: 'auto',
        date: a.appointmentDate,
        title: `เตรียมให้${a.vaccineName}`,
        sub: `คำนวณจากวันครบกำหนดวัคซีน (${this.formatDate(a.vaccineDate)})`,
      });
    }

    for (const m of this.manualAppointments) {
      if (m.coop_id !== this.manualCoopId) continue;
      items.push({
        kind: 'manual',
        date: new Date(m.appointment_date),
        title: 'นัดที่ตั้งเอง',
        sub: 'กดเพื่อเปลี่ยนวันที่',
        manual: m,
      });
    }

    items.sort((x, y) => x.date.getTime() - y.date.getTime());
    return items;
  }

  // เปิดปฏิทินเพื่อ "เปลี่ยนวันที่" ของรายการที่กดมา
  openCalendarForItem(item: CoopAppointmentItem) {
    this.reschedulingItem = item;
    this.isCalendarOpen = true;
    this.cdr.detectChanges();
  }

  // เปิดปฏิทินเพื่อ "เพิ่มนัดใหม่" (ไม่ได้อิงจากรายการไหนเดิม)
  openCalendarForNew() {
    this.reschedulingItem = null;
    this.isCalendarOpen = true;
    this.cdr.detectChanges();
  }

  closeCalendar() {
    this.isCalendarOpen = false;
    this.reschedulingItem = null;
    this.cdr.detectChanges();
  }

  formatDate(date: Date | null): string {
    if (!date) return '';
    return date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  coopNameFor(coopId: number): string {
    const coop = this.coops.find(c => c.coop_id === coopId);
    return coop ? coop.name_coop : `คอก ${coopId}`;
  }

  removeManualAppointment(item: HealthAppointment) {
    this.healthAppointmentService.remove(item.appointment_id).subscribe({
      next: () => {
        this.loadManualAppointments();
        this.loadCoopMarkers();
      },
      error: (err) => {
        console.error('ลบนัดตรวจไม่สำเร็จ:', err);
        this.flashToast('ลบนัดตรวจไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error');
      }
    });
  }

  // เลือกวันที่จากปฏิทินแล้ว - ยังไม่บันทึกทันที ขอให้ยืนยันก่อนเสมอ (กันกดพลาด
  // วันที่ติดกัน) ปิดปฏิทินแล้วเก็บวันที่ไว้รอกดยืนยันในป็อบอัพถัดไป
  onDaySelected(day: Date) {
    this.isCalendarOpen = false;
    this.pendingDay = day;
    this.showConfirmDialog = true;
    this.cdr.detectChanges();
  }

  cancelPendingDate() {
    this.showConfirmDialog = false;
    this.pendingDay = null;
    this.reschedulingItem = null;
    this.cdr.detectChanges();
  }

  // กดยืนยันในป็อบอัพแล้วค่อยบันทึกจริง - ถ้ากำลังเปลี่ยนวันที่ของรายการ "ที่ตั้งเอง"
  // เดิม ให้ลบของเดิมทิ้งก่อนเสมอ (กันค้างเป็นนัดซ้ำซ้อน) ส่วนรายการ "อัตโนมัติ" ไม่มี
  // ของเดิมให้ลบ (ยังไม่เคยถูกบันทึกจริง) แล้วแต่ทั้งคู่ ถ้าวันที่เลือกเป็นวันนี้
  // หรือย้อนหลัง (ถึงกำหนดแล้ว) ให้ไปหน้าบันทึกผลตรวจเลย ไม่ใช่แค่บันทึกนัดไว้เฉยๆ
  confirmPendingDate() {
    const day = this.pendingDay;
    const item = this.reschedulingItem;
    const coopId = this.manualCoopId;
    this.showConfirmDialog = false;
    this.pendingDay = null;
    this.reschedulingItem = null;

    if (!day || coopId == null) {
      this.cdr.detectChanges();
      return;
    }

    const today = new Date();
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const targetOnly = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const isFuture = targetOnly.getTime() > todayOnly.getTime();

    const proceed = () => {
      if (!isFuture) {
        this.router.navigate(['/add-health'], {
          queryParams: { coop_id: coopId, date: formatDateKey(day) }
        });
        return;
      }

      this.healthAppointmentService.create(coopId, day).subscribe({
        next: () => {
          this.flashToast(`บันทึกนัดตรวจสุขภาพวันที่ ${this.formatDate(day)} ลงปฏิทินแล้ว`);
          this.loadManualAppointments();
          this.loadCoopMarkers();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('บันทึกนัดตรวจไม่สำเร็จ:', err);
          this.flashToast('บันทึกนัดตรวจไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error');
        }
      });
    };

    if (item?.kind === 'manual' && item.manual) {
      this.healthAppointmentService.remove(item.manual.appointment_id).subscribe({
        next: proceed,
        error: (err) => {
          console.error('ลบนัดเดิมไม่สำเร็จ:', err);
          this.flashToast('แก้ไขนัดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error');
        }
      });
    } else {
      proceed();
    }

    this.cdr.detectChanges();
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
