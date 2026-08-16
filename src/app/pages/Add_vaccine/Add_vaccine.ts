import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';


@Component({
  selector: 'app-add-vaccine',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './Add_vaccine.html',
  styleUrls: ['./Add_vaccine.scss']
})
export class AddVaccineComponent {

  weekDayLabels = ['MON', 'TUES', 'WEDNES', 'THURS', 'FRI', 'SATUR', 'SUN'];

  currentDate = new Date();
  calendarWeeks: (Date | null)[][] = [];
  vaccineDate: Date | null = new Date();

  coops: any[] = [];
  coopId: number | null = null;
  medicineName: string = '';
  method: string = '';
  ageCondition: string = '';
  note: string = '';

  constructor(private router: Router, private api: ApiService) {
    this.buildCalendar();
    this.loadCoops();
  }

  loadCoops() {
    this.api.get<any[]>(`/coops`).subscribe({
      next: (coops: any[]) => this.coops = coops,
      error: (err: any) => console.error('โหลดรายชื่อคอกไม่สำเร็จ:', err)
    });
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

  selectDay(day: Date | null) {
    if (!day) return;
    this.vaccineDate = day;
  }

  isSelected(day: Date | null): boolean {
    return !!day && !!this.vaccineDate && day.toDateString() === this.vaccineDate.toDateString();
  }

  isToday(day: Date | null): boolean {
    return !!day && day.toDateString() === new Date().toDateString();
  }

  formatDate(date: Date | null): string {
    if (!date) return '';
    return date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  saveVaccine() {
    if (!this.coopId || !this.medicineName.trim() || !this.method || !this.vaccineDate) {
      alert('กรุณาเลือกคอก ชื่อยา วิธีการให้ และวันที่ให้วัคซีนให้ครบถ้วน');
      return;
    }

    const payload = {
      coop_id: this.coopId,
      name: this.medicineName.trim(),
      method: this.method,
      recommended_age: this.ageCondition,
      note: this.note,
      record_date: this.vaccineDate.toISOString()
    };

    this.api.post(`/vaccines`, payload).subscribe({
      next: () => this.router.navigate(['/']),
      error: (err: any) => {
        console.error('บันทึกข้อมูลวัคซีนไม่สำเร็จ:', err);
        alert('บันทึกข้อมูลวัคซีนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      }
    });
  }
}
