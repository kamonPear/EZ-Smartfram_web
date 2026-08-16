import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-add-coop',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './Add_coop.html',
  styleUrls: ['./Add_coop.scss']
})
export class AddCoopComponent {

  weekDayLabels = ['MON', 'TUES', 'WEDNES', 'THURS', 'FRI', 'SATUR', 'SUN'];

  currentDate = new Date();
  calendarWeeks: (Date | null)[][] = [];

  coopName: string = '';
  chickenCount: number | null = null;
  birthDate: Date | null = null;
  note: string = '';
  receivedDate: Date | null = null;

  activeField: 'birth' | 'received' = 'birth';

  constructor(private router: Router, private api: ApiService) {
    this.buildCalendar();
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
    this.activeField = field;
  }

  selectDay(day: Date | null) {
    if (!day) return;
    if (this.activeField === 'birth') {
      this.birthDate = day;
    } else {
      this.receivedDate = day;
    }
  }

  isSelected(day: Date | null): boolean {
    if (!day) return false;
    const target = this.activeField === 'received' ? this.receivedDate : this.birthDate;
    return !!target && day.toDateString() === target.toDateString();
  }

  isToday(day: Date | null): boolean {
    return !!day && day.toDateString() === new Date().toDateString();
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
