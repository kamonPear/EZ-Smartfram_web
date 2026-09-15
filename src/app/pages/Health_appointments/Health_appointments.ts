import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { DatePickerCalendar } from '../../shared/date-picker-calendar/date-picker-calendar';
import { formatDateKey } from '../../shared/calendar-markers.util';
import { addManualHealthAppointment, getManualHealthAppointments, removeManualHealthAppointment, ManualHealthAppointment } from '../../shared/manual-health-appointment.util';
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

// หน้า "นัดตรวจสุขภาพ" รวมทั้งฟาร์ม - มี 2 โหมด:
// - อัตโนมัติ: คำนวณจากวันครบกำหนดวัคซีนของแต่ละคอก (ตรวจก่อนให้วัคซีน 1 วันเสมอ
//   เพื่อคัดเฉพาะไก่แข็งแรง) เหมือนแอปมือถือ (MainHealthAppointments)
// - กำหนดเอง: เจ้าของฟาร์มเลือกคอก+วันที่ตรวจเองตรงๆ ไม่ต้องรอคำนวณจากวัคซีน
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
  isCoopDropdownOpen = false;
  manualDate: Date | null = new Date();
  isCalendarOpen = false;
  // ถ้าไม่ใช่ null แปลว่ากำลังแก้ไขนัดที่มีอยู่แล้ว (ไม่ใช่สร้างนัดใหม่) - เก็บ
  // คอก+วันเดิมไว้ เผื่อต้องลบของเดิมทิ้งตอนบันทึกทับด้วยค่าใหม่
  editingManualAppointment: ManualHealthAppointment | null = null;

  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  constructor(private router: Router, private api: ApiService, private cdr: ChangeDetectorRef) {
    this.fetchAppointments();
    this.loadCoops();
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

  toggleCoopDropdown() {
    this.isCoopDropdownOpen = !this.isCoopDropdownOpen;
    this.cdr.detectChanges();
  }

  selectManualCoop(coop: Coop) {
    this.manualCoopId = coop.coop_id;
    this.isCoopDropdownOpen = false;
    this.cdr.detectChanges();
  }

  get selectedManualCoopName(): string {
    const coop = this.coops.find(c => c.coop_id === this.manualCoopId);
    return coop ? coop.name_coop : '';
  }

  closeDropdowns() {
    this.isCoopDropdownOpen = false;
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
    this.manualDate = day;
    this.isCalendarOpen = false;
    this.cdr.detectChanges();
  }

  formatDate(date: Date | null): string {
    if (!date) return '';
    return date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  get canGoManual(): boolean {
    return this.manualCoopId != null && this.manualDate != null;
  }

  // รายการนัดที่กำหนดเองทั้งหมด (ทุกคอก) เรียงจากใกล้ที่สุดก่อน แสดงใต้ปุ่มบันทึก
  // แก้ไขได้ตราบใดที่ยังไม่ถึงวันนัด (ผ่านไปแล้วจะถูกเก็บกวาดทิ้งเองจาก util)
  get manualAppointmentsList(): { coopId: number; date: string; dateObj: Date }[] {
    return getManualHealthAppointments(null)
      .map(a => ({ ...a, dateObj: new Date(a.date) }))
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  }

  get editingManualOriginalDate(): Date | null {
    return this.editingManualAppointment ? new Date(this.editingManualAppointment.date) : null;
  }

  coopNameFor(coopId: number): string {
    const coop = this.coops.find(c => c.coop_id === coopId);
    return coop ? coop.name_coop : `คอก ${coopId}`;
  }

  editManualAppointment(item: ManualHealthAppointment) {
    this.editingManualAppointment = item;
    this.manualCoopId = item.coopId;
    this.manualDate = new Date(item.date);
    this.cdr.detectChanges();
  }

  cancelManualEdit() {
    this.editingManualAppointment = null;
    this.manualCoopId = null;
    this.manualDate = new Date();
    this.cdr.detectChanges();
  }

  removeManualAppointment(item: ManualHealthAppointment) {
    removeManualHealthAppointment(item.coopId, item.date);
    if (this.editingManualAppointment && this.editingManualAppointment.coopId === item.coopId && this.editingManualAppointment.date === item.date) {
      this.cancelManualEdit();
      return;
    }
    this.cdr.detectChanges();
  }

  get isManualDateFuture(): boolean {
    if (!this.manualDate) return false;
    const today = new Date();
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const targetOnly = new Date(this.manualDate.getFullYear(), this.manualDate.getMonth(), this.manualDate.getDate());
    return targetOnly.getTime() > todayOnly.getTime();
  }

  // กดปุ่มยืนยันนัดตรวจแบบกำหนดเอง - ถ้าเป็นวันนี้หรือย้อนหลัง (ถึงกำหนดตรวจแล้ว)
  // ไปหน้าบันทึกผลตรวจได้เลย แต่ถ้าเป็นวันล่วงหน้า นี่คือการ "นัด" ไว้เฉยๆ ไม่ใช่
  // การกรอกผลตรวจ จึงแค่บันทึกนัดลงปฏิทิน (หน้าบันทึกผลจะล็อกวันที่ตามนัดนี้เองเมื่อ
  // ถึงวันจริง ผ่าน Add_health.computeNearestAppointment / Data_coop.healthAppointment)
  goToManualRecord() {
    if (!this.canGoManual || !this.manualDate || this.manualCoopId == null) return;

    // แก้ไขนัดเดิมอยู่ - ไม่ว่าจะย้ายวันหรือย้ายคอก ให้ลบนัดเดิมทิ้งก่อนเสมอ
    // (กันไม่ให้ค้างเป็นนัดซ้ำซ้อน)
    if (this.editingManualAppointment) {
      removeManualHealthAppointment(this.editingManualAppointment.coopId, this.editingManualAppointment.date);
      this.editingManualAppointment = null;
    }

    const today = new Date();
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const targetOnly = new Date(this.manualDate.getFullYear(), this.manualDate.getMonth(), this.manualDate.getDate());

    if (targetOnly.getTime() <= todayOnly.getTime()) {
      this.router.navigate(['/add-health'], {
        queryParams: { coop_id: this.manualCoopId, date: formatDateKey(this.manualDate) }
      });
      return;
    }

    addManualHealthAppointment(this.manualCoopId, formatDateKey(this.manualDate));
    this.flashToast(`บันทึกนัดตรวจสุขภาพวันที่ ${this.formatDate(this.manualDate)} ลงปฏิทินแล้ว`);
    this.manualCoopId = null;
    this.manualDate = new Date();
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
