import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { DEVICE_ICON_CHOICES } from '../../shared/device-icon.util';

// หน้า "เพิ่มอุปกรณ์" (ชนิดอุปกรณ์ใหม่ที่ซื้อมา) - คนละหน้ากับ Set_up_System ที่ใช้
// ลากอุปกรณ์ไปวางบนแคนวาสของคอก หน้านี้แค่ตั้งชื่อ+เลือกไอคอนไว้ล่วงหน้า บันทึกผ่าน
// POST /api/device-types แล้วชนิดที่เพิ่มจะไปโผล่ในถาดอุปกรณ์ของ Set_up_System เอง
// (เฉพาะในฟาร์มของตัวเองเท่านั้น ฟาร์มอื่นไม่เห็น)
@Component({
  selector: 'app-add-device-type',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './Add_device_type.html',
  styleUrls: ['./Add_device_type.scss']
})
export class AddDeviceTypeComponent {
  readonly iconChoices = DEVICE_ICON_CHOICES;

  name = '';
  selectedIcon: string | null = null;
  isSaving = false;

  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  constructor(
    private location: Location,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  selectIcon(src: string) {
    this.selectedIcon = src;
  }

  cancel() {
    this.location.back();
  }

  private flashToast(message: string, type: 'success' | 'error' = 'success') {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.showToast = false;
      this.cdr.detectChanges();
    }, 2500);
  }

  save() {
    const trimmedName = this.name.trim();
    if (!trimmedName) {
      this.flashToast('กรุณาตั้งชื่ออุปกรณ์', 'error');
      return;
    }
    if (!this.selectedIcon) {
      this.flashToast('กรุณาเลือกไอคอนอุปกรณ์', 'error');
      return;
    }

    this.isSaving = true;
    this.api.post('/device-types', { name: trimmedName, icon: this.selectedIcon }).subscribe({
      next: () => {
        this.isSaving = false;
        this.flashToast('เพิ่มอุปกรณ์สำเร็จ!');
        setTimeout(() => this.location.back(), 900);
      },
      error: (err) => {
        this.isSaving = false;
        console.error('เพิ่มอุปกรณ์ไม่สำเร็จ:', err);
        const serverMsg = typeof err.error === 'string' ? err.error.trim() : '';
        this.flashToast(serverMsg || 'เพิ่มอุปกรณ์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error');
      }
    });
  }
}
