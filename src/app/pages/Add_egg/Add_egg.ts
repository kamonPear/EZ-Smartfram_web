import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { DatePickerCalendar } from '../../shared/date-picker-calendar/date-picker-calendar';
import { DayMarker, loadCalendarMarkers } from '../../shared/calendar-markers.util';

@Component({
  selector: 'app-add-egg',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, DatePickerCalendar],
  templateUrl: './Add_egg.html',
  styleUrls: ['./Add_egg.scss']
})
export class AddEggComponent {

  collectDate: Date | null = new Date();
  isCalendarOpen: boolean = false;
  dayMarkers: Map<string, DayMarker> | null = null;

  coops: any[] = [];
  coopId: number | null = null;
  eggCount: number | null = null;
  note: string = '';

  isCoopDropdownOpen: boolean = false;

  constructor(private router: Router, private api: ApiService) {
    this.loadCoops();
    this.loadMarkers();
  }

  get selectedCoopName(): string {
    const coop = this.coops.find(c => c.coop_id === this.coopId);
    return coop ? coop.name_coop : '';
  }

  toggleCoopDropdown() {
    this.isCoopDropdownOpen = !this.isCoopDropdownOpen;
  }

  selectCoop(coop: any) {
    this.coopId = coop.coop_id;
    this.isCoopDropdownOpen = false;
    this.loadMarkers();
  }

  closeDropdowns() {
    this.isCoopDropdownOpen = false;
  }

  loadCoops() {
    this.api.get<any[]>(`/coops`).subscribe({
      next: (coops: any[]) => this.coops = coops,
      error: (err: any) => console.error('โหลดรายชื่อคอกไม่สำเร็จ:', err)
    });
  }

  loadMarkers() {
    // ก่อนเลือกคอก โชว์มาร์คปฏิทินรวมทั้งฟาร์ม พอเลือกคอกแล้วค่อยกรองให้เหลือแค่คอกนั้น
    loadCalendarMarkers(this.api, this.coopId).subscribe({
      next: (markers) => this.dayMarkers = markers,
      error: (err) => console.error('โหลดข้อมูลมาร์คปฏิทินไม่สำเร็จ:', err)
    });
  }

  openCalendar() {
    this.closeDropdowns();
    this.isCalendarOpen = true;
  }

  closeCalendar() {
    this.isCalendarOpen = false;
  }

  onDaySelected(day: Date) {
    this.collectDate = day;
    this.isCalendarOpen = false;
  }

  formatDate(date: Date | null): string {
    if (!date) return '';
    return date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  saveEgg() {
    if (!this.coopId || !this.eggCount || this.eggCount < 1 || !this.collectDate) {
      alert('กรุณาเลือกคอก จำนวนไข่ และวันที่เก็บไข่ให้ครบถ้วน');
      return;
    }

    const payload = {
      coop_id: this.coopId,
      number_egg: this.eggCount,
      note: this.note,
      date_collect_egg: this.collectDate.toISOString()
    };

    this.api.post(`/eggs`, payload).subscribe({
      next: () => this.router.navigate(['/']),
      error: (err: any) => {
        console.error('บันทึกข้อมูลไข่ไก่ไม่สำเร็จ:', err);
        alert('บันทึกข้อมูลไข่ไก่ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      }
    });
  }
}
