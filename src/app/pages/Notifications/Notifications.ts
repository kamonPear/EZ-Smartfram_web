import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { FarmNotification, NotificationsService } from '../../services/notifications.service';

// รวมการแจ้งเตือนทั้งฟาร์มไว้ที่เดียว (อาหารใกล้หมด/หมด, ใกล้ถึงกำหนดวัคซีน,
// ใกล้ถึงกำหนดตรวจสุขภาพก่อนให้วัคซีน) - พอร์ตตรรกะเดียวกับ Notifications_.dart
// ของแอปมือถือ (ผ่าน NotificationsService ที่พอร์ต notifications_service.dart มา)
@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './Notifications.html',
  styleUrls: ['./Notifications.scss']
})
export class NotificationsComponent {
  isLoading = true;
  notifications: FarmNotification[] = [];

  constructor(
    private router: Router,
    private api: ApiService,
    private notificationsService: NotificationsService,
    private cdr: ChangeDetectorRef
  ) {
    this.load();
  }

  load() {
    this.isLoading = true;
    this.notificationsService.load().subscribe({
      next: (list) => {
        this.notifications = list;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('โหลดการแจ้งเตือนไม่สำเร็จ:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  iconFor(n: FarmNotification): 'vaccine' | 'health' | 'food' {
    return n.type;
  }

  buttonLabel(n: FarmNotification): string {
    if (n.type === 'food') return 'รับทราบ';
    if (n.type === 'health') return 'ไปตรวจสุขภาพ';
    return 'เสร็จสิ้น';
  }

  handleAction(n: FarmNotification) {
    if (n.type === 'vaccine') {
      // id ของแจ้งเตือนวัคซีนคือ "vaccine_<alertId>" ตัดคำนำหน้าออกก่อนยิง PUT
      const alertId = n.id.replace(/^vaccine_/, '');
      this.api.put(`/vaccines/alerts?id=${alertId}`, { is_completed: true }).subscribe({
        next: () => this.removeLocal(n),
        error: (err) => {
          console.error('อัปเดตสถานะวัคซีนไม่สำเร็จ:', err);
          this.cdr.detectChanges();
        }
      });
      return;
    }

    if (n.type === 'health') {
      // ไปหน้าตรวจสุขภาพของคอกนั้นให้กรอกผลตรวจจริง (ไม่ตัดออกจากรายการทันที
      // เผื่อกดแล้วไม่ได้กรอกจริง - รีเฟรชรายการใหม่ตอนกลับมาหน้านี้แทน)
      this.router.navigate(['/add-health'], { queryParams: { coop_id: n.coopId } });
      return;
    }

    // type === 'food': ไม่มี endpoint สำหรับ "รับทราบ" สต็อกอาหาร แค่ปิดออกจาก
    // หน้าจอตอนนี้เท่านั้น (จะกลับมาเตือนใหม่ถ้ายังใกล้หมดอยู่ตอนโหลดหน้าใหม่)
    this.removeLocal(n);
  }

  private removeLocal(n: FarmNotification) {
    this.notifications = this.notifications.filter(x => x !== n);
    this.cdr.detectChanges();
  }
}
