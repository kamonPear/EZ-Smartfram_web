import { Component } from '@angular/core';
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

  constructor(private router: Router, private api: ApiService) {
    // มาร์คนี้ไม่ผูกกับคอกใดคอกหนึ่ง (ยังไม่มีคอกนี้อยู่จริง) เลยโชว์ข้อมูลรวมทั้งฟาร์ม
    loadCalendarMarkers(this.api).subscribe({
      next: (markers) => this.dayMarkers = markers,
      error: (err) => console.error('โหลดข้อมูลมาร์คปฏิทินไม่สำเร็จ:', err)
    });
  }

  selectDateField(field: 'birth' | 'received') {
    this.activeField = field;
  }

  closeCalendar() {
    this.activeField = null;
  }

  onDaySelected(day: Date) {
    if (this.activeField === 'birth') {
      this.birthDate = day;
    } else if (this.activeField === 'received') {
      this.receivedDate = day;
    }
    this.activeField = null;
  }

  formatDate(date: Date | null): string {
    if (!date) return '';
    return date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  addCoop() {
    if (!this.coopName.trim() || !this.chickenCount || this.chickenCount < 1 || !this.birthDate || !this.receivedDate) {
      alert('กรุณากรอกชื่อคอก จำนวนไก่ วันเกิดไก่ และวันที่รับเข้าเลี้ยงให้ครบถ้วน');
      return;
    }

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
        console.error('เพิ่มคอกไม่สำเร็จ:', err);
        if (err.status === 409) {
          alert('ชื่อคอกนี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น');
        } else {
          alert('เพิ่มคอกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        }
      }
    });
  }
}
