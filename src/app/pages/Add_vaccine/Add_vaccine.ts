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
  minAgeDays: number | null = null;
  maxAgeDays: number | null = null;
  description: string = '';

  methodOptions = ['พ่น', 'ฉีด', 'หยอดปาก', 'ผสมน้ำ', 'ผสมอาหาร'];
  isMethodDropdownOpen: boolean = false;

  // รายชื่อยา/วัคซีนที่มีอยู่แล้วในระบบ - โชว์ให้ดูกันพลาดกรอกซ้ำ และใช้เช็ค
  // ชื่อซ้ำแบบเรียลไทม์ตอนพิมพ์ ก่อนจะยิงไปถามฝั่ง backend อีกรอบตอนกดบันทึก
  schedules: MedicineSchedule[] = [];
  isLoadingSchedules = true;

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
