import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { DatePickerCalendar } from '../../shared/date-picker-calendar/date-picker-calendar';
import { DayMarker, loadCalendarMarkers } from '../../shared/calendar-markers.util';

@Component({
  selector: 'app-add-coop',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, DatePickerCalendar],
  templateUrl: './Add_coop.html',
  styleUrls: ['./Add_coop.scss']
})
export class AddCoopComponent {

  coopName: string = '';
  chickenCount: number | null = null;
  birthDate: Date | null = null;
  note: string = '';
  receivedDate: Date | null = null;

  activeField: 'birth' | 'received' | null = null;
  dayMarkers: Map<string, DayMarker> | null = null;

  // ชื่อคอกที่มีอยู่แล้วในระบบ - เช็คซ้ำแบบเรียลไทม์ตอนพิมพ์ ก่อนจะยิงไปถามฝั่ง
  // backend อีกรอบตอนกดบันทึก (backend เองก็เช็คซ้ำอยู่แล้ว แต่เดิมแจ้งผ่าน
  // alert() ธรรมดา ไม่เห็นจนกว่าจะกดบันทึกไปก่อน)
  existingCoopNames: string[] = [];

  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  isSaving = false;

  constructor(private router: Router, private api: ApiService, private cdr: ChangeDetectorRef) {
    // มาร์คนี้ไม่ผูกกับคอกใดคอกหนึ่ง (ยังไม่มีคอกนี้อยู่จริง) เลยโชว์ข้อมูลรวมทั้งฟาร์ม
    loadCalendarMarkers(this.api).subscribe({
      next: (markers) => this.dayMarkers = markers,
      error: (err) => console.error('โหลดข้อมูลมาร์คปฏิทินไม่สำเร็จ:', err)
    });

    this.api.get<any[]>('/coops').subscribe({
      next: (coops) => {
        this.existingCoopNames = (coops || []).map(c => (c.name_coop || '').trim().toLowerCase()).filter(Boolean);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('โหลดรายชื่อคอกไม่สำเร็จ:', err);
        this.cdr.detectChanges();
      }
    });
  }

  get isDuplicateName(): boolean {
    const name = this.coopName.trim().toLowerCase();
    if (!name) return false;
    return this.existingCoopNames.includes(name);
  }

  selectDateField(field: 'birth' | 'received') {
    this.activeField = field;
    this.cdr.detectChanges();
  }

  closeCalendar() {
    this.activeField = null;
    this.cdr.detectChanges();
  }

  onDaySelected(day: Date) {
    if (this.activeField === 'birth') {
      this.birthDate = day;
    } else if (this.activeField === 'received') {
      this.receivedDate = day;
    }
    this.activeField = null;
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

  addCoop() {
    if (!this.coopName.trim() || !this.chickenCount || this.chickenCount < 1 || !this.birthDate || !this.receivedDate) {
      this.flashToast('กรุณากรอกชื่อคอก จำนวนไก่ วันเกิดไก่ และวันที่รับเข้าเลี้ยงให้ครบถ้วน', 'error');
      return;
    }

    if (this.isDuplicateName) {
      this.flashToast('ชื่อคอกนี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น', 'error');
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

    this.api.post(`/coops`, payload).subscribe({
      next: () => this.router.navigate(['/']),
      error: (err: any) => {
        this.isSaving = false;
        console.error('เพิ่มคอกไม่สำเร็จ:', err);
        if (err.status === 409) {
          this.flashToast('ชื่อคอกนี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น', 'error');
        } else {
          this.flashToast('เพิ่มคอกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error');
        }
        this.cdr.detectChanges();
      }
    });
  }
}
