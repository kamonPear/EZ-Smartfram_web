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

  medicineName: string = '';
  method: string = '';
  minAgeDays: number | null = null;
  maxAgeDays: number | null = null;
  description: string = '';

  methodOptions = ['พ่น', 'ฉีด', 'หยอดปาก', 'ผสมน้ำ', 'ผสมอาหาร'];
  isMethodDropdownOpen: boolean = false;

  constructor(private router: Router, private api: ApiService) {}

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

  saveVaccine() {
    if (!this.medicineName.trim() || !this.method || this.minAgeDays === null || this.maxAgeDays === null) {
      alert('กรุณาระบุชื่อยา วิธีการให้ และช่วงอายุ (ต่ำสุด-สูงสุด) ให้ครบถ้วน');
      return;
    }

    if (this.minAgeDays > this.maxAgeDays) {
      alert('อายุต่ำสุดต้องไม่มากกว่าอายุสูงสุด');
      return;
    }

    const payload = {
      name: this.medicineName.trim(),
      method: this.method,
      min_age_days: this.minAgeDays,
      max_age_days: this.maxAgeDays,
      description: this.description
    };

    this.api.post(`/vaccines/schedule`, payload).subscribe({
      next: () => this.router.navigate(['/']),
      error: (err: any) => {
        console.error('บันทึกข้อมูลวัคซีนไม่สำเร็จ:', err);
        alert('บันทึกข้อมูลวัคซีนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      }
    });
  }
}
