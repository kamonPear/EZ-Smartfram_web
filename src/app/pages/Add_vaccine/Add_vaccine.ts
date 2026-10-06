import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

interface MedicineSchedule {
  id: number;
  name: string;
  method: string;
  min_age_days: number;
  max_age_days: number;
  description: string;
}

interface MatchingCoop {
  coop_id: number;
  name_coop: string;
  current_age_days: number;
  status: 'due' | 'overdue';
}

interface MatchingCoopsResponse {
  vaccine_id: number;
  vaccine_name: string;
  min_age_days: number;
  max_age_days: number;
  matching_coops: MatchingCoop[];
}

// เพิ่ม "ประเภท" วัคซีน/ยาใหม่เข้าตาราง medicine_schedules (ไม่ใช่การบันทึกว่า
// ให้วัคซีนคอกใดคอกหนึ่งไปแล้ว - นั่นทำที่ปุ่ม "ให้วัคซีน" ในหน้าข้อมูลคอกไก่
// แทน) ตรงกับคอนเซปของแอปมือถือ (Add_VaccineType.dart -> POST /vaccines/schedule)
@Component({
  selector: 'app-add-vaccine',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './Add_vaccine.html',
  styleUrls: ['./Add_vaccine.scss']
})
export class AddVaccineComponent {

  medicineName: string = '';
  method: string = '';
  // minAgeDays/maxAgeDays คือค่าจริงที่ส่งไป backend (int, หน่วยวัน) - minAgeWeeks/
  // minAgeMonths/maxAgeWeeks/maxAgeMonths เป็นแค่ช่องกรอก/แสดงหน่วยอื่นควบคู่กัน
  // ไปด้วย (ดู onMinDaysChange/onMinWeeksChange/... ด้านล่าง) เพื่อให้เจ้าของฟาร์ม
  // กรอกเป็นสัปดาห์หรือเดือนก็ได้โดยไม่ต้องแปลงเป็นวันเอง
  minAgeDays: number | null = null;
  minAgeWeeks: number | null = null;
  minAgeMonths: number | null = null;
  maxAgeDays: number | null = null;
  maxAgeWeeks: number | null = null;
  maxAgeMonths: number | null = null;
  description: string = '';

  methodOptions = ['พ่น', 'ฉีด', 'หยอดปาก', 'ผสมน้ำ', 'ผสมอาหาร'];
  isMethodDropdownOpen: boolean = false;

  // รายชื่อยา/วัคซีนที่มีอยู่แล้วในระบบ - โชว์ให้ดูกันพลาดกรอกซ้ำ และใช้เช็ค
  // ชื่อซ้ำแบบเรียลไทม์ตอนพิมพ์ ก่อนจะยิงไปถามฝั่ง backend อีกรอบตอนกดบันทึก
  schedules: MedicineSchedule[] = [];
  isLoadingSchedules = true;

  // คอกที่ตอนนี้อายุเข้าเกณฑ์ของวัคซีนแต่ละประเภทแล้ว (เปิดดูทีละตัวตอนคลิกแถว ไม่ต้อง
  // โหลดของทุกแถวพร้อมกันตั้งแต่แรก) - key เป็น schedule.id
  expandedScheduleId: number | null = null;
  matchingCoopsByScheduleId = new Map<number, MatchingCoop[]>();
  isLoadingMatchingCoops = false;

  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  isSaving = false;

  constructor(private router: Router, private api: ApiService, private cdr: ChangeDetectorRef) {
    this.loadSchedules();
  }

  loadSchedules() {
    this.isLoadingSchedules = true;
    this.api.get<MedicineSchedule[]>('/vaccines/schedule').subscribe({
      next: (data) => {
        this.schedules = (data || []).sort((a, b) => a.name.localeCompare(b.name, 'th'));
        this.isLoadingSchedules = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('โหลดรายการยา/วัคซีนไม่สำเร็จ:', err);
        this.isLoadingSchedules = false;
        this.cdr.detectChanges();
      }
    });
  }

  toggleMatchingCoops(schedule: MedicineSchedule) {
    if (this.expandedScheduleId === schedule.id) {
      this.expandedScheduleId = null;
      return;
    }
    this.expandedScheduleId = schedule.id;
    if (this.matchingCoopsByScheduleId.has(schedule.id)) {
      return; // โหลดไปแล้วรอบก่อน ไม่ต้องยิงซ้ำ
    }
    this.isLoadingMatchingCoops = true;
    this.api.get<MatchingCoopsResponse>(`/vaccines/schedule/matching-coops?id=${schedule.id}`).subscribe({
      next: (data) => {
        this.matchingCoopsByScheduleId.set(schedule.id, data?.matching_coops || []);
        this.isLoadingMatchingCoops = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('โหลดรายชื่อคอกที่ต้องให้วัคซีนไม่สำเร็จ:', err);
        this.matchingCoopsByScheduleId.set(schedule.id, []);
        this.isLoadingMatchingCoops = false;
        this.cdr.detectChanges();
      }
    });
  }

  matchingCoopsFor(schedule: MedicineSchedule): MatchingCoop[] {
    return this.matchingCoopsByScheduleId.get(schedule.id) || [];
  }

  // เทียบแบบไม่สนตัวพิมพ์เล็ก-ใหญ่และช่องว่างหัว-ท้าย ตรงกับที่ backend เช็คซ้ำ
  get isDuplicateName(): boolean {
    const name = this.medicineName.trim().toLowerCase();
    if (!name) return false;
    return this.schedules.some(s => s.name.trim().toLowerCase() === name);
  }

  toggleMethodDropdown() {
    this.isMethodDropdownOpen = !this.isMethodDropdownOpen;
  }

  selectMethod(method: string) {
    this.method = method;
    this.isMethodDropdownOpen = false;
  }

  closeDropdowns() {
    this.isMethodDropdownOpen = false;
  }

  private round1(n: number): number {
    return Math.round(n * 10) / 10;
  }

  // เดือนโชว์เป็นจำนวนเต็มเสมอ ไม่มีทศนิยม (เช่น 10 วัน = "0 เดือน" ไม่ใช่ "0.3
  // เดือน") - นับเฉพาะเดือนที่ครบจริงๆ เหมือนวิธีนับอายุทั่วไป ถ้ายังไม่ครบเดือน
  // ถัดไปก็ยังนับเป็นเดือนก่อนหน้าอยู่ จึงปัดลง (floor) ไม่ใช่ปัดเข้าใกล้
  private monthsWhole(days: number): number {
    return Math.floor(days / 30);
  }

  // เรียกตอนแก้ช่อง "วัน" (ต่ำสุด) - วันเป็นค่าหลักอยู่แล้ว แค่คำนวณสัปดาห์/เดือน
  // ที่เทียบเท่ากันมาโชว์คู่กัน
  onMinDaysChange() {
    if (this.minAgeDays === null || isNaN(this.minAgeDays)) {
      this.minAgeWeeks = null;
      this.minAgeMonths = null;
      return;
    }
    this.minAgeWeeks = this.round1(this.minAgeDays / 7);
    this.minAgeMonths = this.monthsWhole(this.minAgeDays);
  }

  // เรียกตอนแก้ช่อง "สัปดาห์" (ต่ำสุด) - แปลงเป็นวันก่อน (ปัดเศษ เพราะ backend รับ
  // แค่ int) แล้วคำนวณเดือนที่เทียบเท่าใหม่จากวันนั้น ไม่แตะช่องสัปดาห์เอง กันค่าที่
  // เพิ่งพิมพ์โดนปัดเปลี่ยนขณะพิมพ์อยู่
  onMinWeeksChange() {
    if (this.minAgeWeeks === null || isNaN(this.minAgeWeeks)) {
      this.minAgeDays = null;
      this.minAgeMonths = null;
      return;
    }
    this.minAgeDays = Math.round(this.minAgeWeeks * 7);
    this.minAgeMonths = this.monthsWhole(this.minAgeDays);
  }

  // เรียกตอนแก้ช่อง "เดือน" (ต่ำสุด) - หลักการเดียวกับ onMinWeeksChange
  onMinMonthsChange() {
    if (this.minAgeMonths === null || isNaN(this.minAgeMonths)) {
      this.minAgeDays = null;
      this.minAgeWeeks = null;
      return;
    }
    this.minAgeMonths = Math.floor(this.minAgeMonths);
    this.minAgeDays = Math.round(this.minAgeMonths * 30);
    this.minAgeWeeks = this.round1(this.minAgeDays / 7);
  }

  onMaxDaysChange() {
    if (this.maxAgeDays === null || isNaN(this.maxAgeDays)) {
      this.maxAgeWeeks = null;
      this.maxAgeMonths = null;
      return;
    }
    this.maxAgeWeeks = this.round1(this.maxAgeDays / 7);
    this.maxAgeMonths = this.monthsWhole(this.maxAgeDays);
  }

  onMaxWeeksChange() {
    if (this.maxAgeWeeks === null || isNaN(this.maxAgeWeeks)) {
      this.maxAgeDays = null;
      this.maxAgeMonths = null;
      return;
    }
    this.maxAgeDays = Math.round(this.maxAgeWeeks * 7);
    this.maxAgeMonths = this.monthsWhole(this.maxAgeDays);
  }

  onMaxMonthsChange() {
    if (this.maxAgeMonths === null || isNaN(this.maxAgeMonths)) {
      this.maxAgeDays = null;
      this.maxAgeWeeks = null;
      return;
    }
    this.maxAgeMonths = Math.floor(this.maxAgeMonths);
    this.maxAgeDays = Math.round(this.maxAgeMonths * 30);
    this.maxAgeWeeks = this.round1(this.maxAgeDays / 7);
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

  saveVaccine() {
    if (!this.medicineName.trim() || !this.method || this.minAgeDays === null || this.maxAgeDays === null) {
      this.flashToast('กรุณาระบุชื่อยา วิธีการให้ และช่วงอายุ (ต่ำสุด-สูงสุด) ให้ครบถ้วน', 'error');
      return;
    }

    if (this.minAgeDays > this.maxAgeDays) {
      this.flashToast('อายุต่ำสุดต้องไม่มากกว่าอายุสูงสุด', 'error');
      return;
    }

    if (this.isDuplicateName) {
      this.flashToast('มียา/วัคซีนชื่อนี้อยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น', 'error');
      return;
    }

    this.isSaving = true;
    const payload = {
      name: this.medicineName.trim(),
      method: this.method,
      min_age_days: this.minAgeDays,
      max_age_days: this.maxAgeDays,
      description: this.description
    };

    this.api.post(`/vaccines/schedule`, payload).subscribe({
      next: () => this.router.navigate(['/home']),
      error: (err: any) => {
        this.isSaving = false;
        console.error('บันทึกข้อมูลวัคซีนไม่สำเร็จ:', err);
        if (err.status === 409) {
          this.flashToast('มียา/วัคซีนชื่อนี้อยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น', 'error');
        } else {
          this.flashToast('บันทึกข้อมูลวัคซีนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error');
        }
        this.cdr.detectChanges();
      }
    });
  }
}
