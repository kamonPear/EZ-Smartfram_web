import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DayMarker, formatDateKey } from '../calendar-markers.util';

@Component({
  selector: 'app-date-picker-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './date-picker-calendar.html',
  styleUrls: ['./date-picker-calendar.scss']
})
export class DatePickerCalendar implements OnChanges {
  @Input() title = 'เลือกวันที่';
  @Input() selectedDate: Date | null = null;
  @Input() markers: Map<string, DayMarker> | null = null;
  // โหมด "ดูอย่างเดียว" (ไม่ใช่ตัวเลือกวันที่สำหรับฟอร์ม) - คลิกวันที่แล้วกาง
  // รายละเอียดของวันนั้นลงมาด้านล่างในป็อบอัพเดียวกันเลย อ่านง่ายกว่า title
  // tooltip เดิมที่ต้องเอาเมาส์ไปชี้ค้าง (ใช้ไม่ได้บนมือถือ/แท็บเล็ตด้วย)
  @Input() viewOnly = false;

  @Output() daySelected = new EventEmitter<Date>();
  @Output() closed = new EventEmitter<void>();

  weekDayLabels = ['MON', 'TUES', 'WEDNES', 'THURS', 'FRI', 'SATUR', 'SUN'];
  currentDate = new Date();
  calendarWeeks: (Date | null)[][] = [];
  selectedDetailDay: Date | null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedDate']) {
      this.currentDate = this.selectedDate || new Date();
    }
    // โหมดดูอย่างเดียว (ไม่มี selectedDate ให้ยึด) - ถ้ามีมาร์คอยู่ ให้เปิดที่
    // เดือนของมาร์คที่ใกล้วันนี้ที่สุดเลย ไม่ใช่เดือนปัจจุบันเสมอไป เพราะไม่งั้น
    // ถ้ามาร์ค (เช่นวันเกิด/วันรับเข้าเลี้ยง) อยู่เดือนอื่น จะดูเหมือนไม่มีมาร์คขึ้น
    // เลยจนกว่าจะกดเปลี่ยนเดือนเอง
    if ((changes['markers'] || changes['selectedDate']) && this.viewOnly && !this.selectedDate && this.markers && this.markers.size > 0) {
      this.currentDate = this.nearestMarkerDate() ?? new Date();
    }
    this.buildCalendar();
  }

  private nearestMarkerDate(): Date | null {
    if (!this.markers) return null;
    const today = new Date();
    let closest: Date | null = null;
    let closestDiff = Infinity;
    for (const key of this.markers.keys()) {
      const d = new Date(key);
      if (isNaN(d.getTime())) continue;
      const diff = Math.abs(d.getTime() - today.getTime());
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = d;
      }
    }
    return closest;
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

  // แอปนี้ไม่มี zone.js เลย ปุ่มเปลี่ยนเดือน/เลือกวันที่ต้องยิง detectChanges()
  // เองตรงๆ กันเหตุการณ์คลิกไม่อัปเดตหน้าจอ (เจอบั๊กแบบนี้มาแล้วหลายจุดในเว็บนี้)
  prevMonth() {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
    this.selectedDetailDay = null;
    this.buildCalendar();
    this.cdr.detectChanges();
  }

  nextMonth() {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
    this.selectedDetailDay = null;
    this.buildCalendar();
    this.cdr.detectChanges();
  }

  selectDay(day: Date | null) {
    if (!day) return;
    // โหมดดูอย่างเดียว: คลิกวันที่แค่กาง/ยุบรายละเอียดของวันนั้นในป็อบอัพเดิม
    // ไม่ได้เลือกวันที่เข้าฟอร์ม (ไม่ emit daySelected / ไม่ปิดป็อบอัพ)
    if (this.viewOnly) {
      const same = this.selectedDetailDay && day.toDateString() === this.selectedDetailDay.toDateString();
      this.selectedDetailDay = same ? null : day;
      this.cdr.detectChanges();
      return;
    }
    this.daySelected.emit(day);
  }

  get selectedDetailMarker(): DayMarker | null {
    return this.markerFor(this.selectedDetailDay);
  }

  formatDetailDate(day: Date | null): string {
    if (!day) return '';
    return day.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  close() {
    this.closed.emit();
  }

  isSelected(day: Date | null): boolean {
    if (!day) return false;
    if (this.viewOnly) {
      return !!this.selectedDetailDay && day.toDateString() === this.selectedDetailDay.toDateString();
    }
    return !!this.selectedDate && day.toDateString() === this.selectedDate.toDateString();
  }

  isToday(day: Date | null): boolean {
    return !!day && day.toDateString() === new Date().toDateString();
  }

  markerFor(day: Date | null): DayMarker | null {
    if (!day || !this.markers) return null;
    return this.markers.get(formatDateKey(day)) || null;
  }

  tooltipFor(day: Date | null): string {
    return this.markerFor(day)?.details.join('\n') || '';
  }
}
