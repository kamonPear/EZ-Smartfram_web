import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
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

  @Output() daySelected = new EventEmitter<Date>();
  @Output() closed = new EventEmitter<void>();

  weekDayLabels = ['MON', 'TUES', 'WEDNES', 'THURS', 'FRI', 'SATUR', 'SUN'];
  currentDate = new Date();
  calendarWeeks: (Date | null)[][] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedDate']) {
      this.currentDate = this.selectedDate || new Date();
      this.buildCalendar();
    }
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
    this.daySelected.emit(day);
  }

  close() {
    this.closed.emit();
  }

  isSelected(day: Date | null): boolean {
    return !!day && !!this.selectedDate && day.toDateString() === this.selectedDate.toDateString();
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
