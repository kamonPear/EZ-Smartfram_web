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

  // แจ้งผลลัพธ์กดปุ่ม "เสร็จสิ้น" ของวัคซีน - ของเดิมกดแล้วการ์ดหายไปเงียบๆ ไม่รู้
  // ว่าบันทึกสำเร็จจริงไหม
  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

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

  iconFor(n: FarmNotification): 'vaccine' | 'health' | 'food' | 'motion' {
    return n.type;
  }

  // คลิกที่ตัวการ์ด (ไม่ใช่ปุ่ม) ไปหน้าที่เกี่ยวข้องของคอกนั้นเลย - สุขภาพไปหน้า
  // ตรวจสุขภาพ, วัคซีนไปหน้าให้วัคซีน (คนละหน้ากับปุ่ม "เสร็จสิ้น" ที่บันทึกสถานะ
  // ตรงๆ โดยไม่เปลี่ยนหน้า) ส่วนอาหาร/ความเคลื่อนไหวไม่มีหน้าที่เกี่ยวข้องให้ไป กดการ์ด
  // แล้วไม่ทำอะไร
  cardClick(n: FarmNotification) {
    if (n.type === 'health') {
      this.router.navigate(['/add-health'], { queryParams: { coop_id: n.coopId } });
    } else if (n.type === 'vaccine') {
      this.router.navigate(['/give-vaccine'], { queryParams: { coop_id: n.coopId } });
    }
  }

  // ✅ กดสำเร็จก่อนถึงวันครบกำหนดจริงไม่ได้ (เดิมกดได้ตลอด แม้แจ้งเตือนจะบอกว่า
  // "อีก X วันถึงกำหนด" อยู่ก็ตาม) - ปุ่มนี้คุมแค่ชั้น UI เป็นด่านแรก ส่วน backend
  // ก็เช็คซ้ำอีกชั้นเป็นด่านจริง (กันเรียก API ตรงๆ ข้ามหน้านี้ไปเลย)
  canCompleteVaccine(n: FarmNotification): boolean {
    return n.type !== 'vaccine' || n.daysUntil <= 0;
  }

  buttonLabel(n: FarmNotification): string {
    if (n.type === 'food') return 'รับทราบ';
    if (n.type === 'health') return 'ไปตรวจสุขภาพ';
    if (n.type === 'motion') return 'รับทราบ';
    if (n.type === 'vaccine' && !this.canCompleteVaccine(n)) return 'ยังไม่ถึงวันให้';
    return 'เสร็จสิ้น';
  }

  handleAction(n: FarmNotification) {
    if (n.type === 'vaccine') {
      if (!this.canCompleteVaccine(n)) {
        this.flashToast('ยังไม่ถึงวันครบกำหนดให้วัคซีนนี้ กดสำเร็จก่อนไม่ได้', 'error');
        return;
      }
      // id ของแจ้งเตือนวัคซีนคือ "vaccine_<alertId>" ตัดคำนำหน้าออกก่อนยิง PUT
      const alertId = n.id.replace(/^vaccine_/, '');
      this.api.put(`/vaccines/alerts?id=${alertId}`, {
        is_completed: true,
        method: n.method,
        chicken_age: n.chickenAge,
        note: n.description,
      }).subscribe({
        next: () => {
          this.flashToast('บันทึกแล้ว - คอกนี้ได้รับวัคซีนแล้ว', 'success');
          this.removeLocal(n);
        },
        error: (err) => {
          console.error('อัปเดตสถานะวัคซีนไม่สำเร็จ:', err);
          // ข้อความจริงจาก backend (เช่น "ยังไม่ถึงวันครบกำหนด...") ถ้ามี แทน
          // ข้อความกลางๆ ที่ทำให้เข้าใจผิดว่าแค่ลองใหม่แล้วจะผ่าน
          const serverMsg = typeof err.error === 'string' ? err.error.trim() : '';
          this.flashToast(serverMsg || 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error');
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

  private flashToast(message: string, type: 'success' | 'error' = 'success') {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.showToast = false;
      this.cdr.detectChanges();
    }, 2800);
  }
}
