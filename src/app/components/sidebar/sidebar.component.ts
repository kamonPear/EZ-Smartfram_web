import { Component, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ThemeService } from '../../services/theme.service';
import { NotificationsService } from '../../services/notifications.service';
import { AuthService } from '../../services/auth.service';

interface MenuItem {
  label: string;
  icon?: string;
  // ไม่มีรูป PNG ที่เหมาะกับเมนูนี้ในชุด assets ปัจจุบัน ใช้ไอคอน SVG ฝังตรงๆ
  // แทน (คล้ายไอคอนโหมดมืด/สว่างด้านล่าง) กันไม่ต้องเพิ่มไฟล์รูปใหม่
  svgIcon?: 'health' | 'notification';
  route?: string;
  action?: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {
  isOpen = signal(false);
  notificationCount = 0;

  constructor(
    private location: Location,
    private themeService: ThemeService,
    private notificationsService: NotificationsService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.themeService.load();
    // แสดงจำนวนแจ้งเตือนเป็นตัวเลขบนเมนู "การแจ้งเตือน" ให้เห็นตั้งแต่ยังไม่กด
    // เข้าไปดู - ไซด์บาร์อยู่ทุกหน้าเลยโหลดได้บ่อยพอที่จะถือว่าเป็นค่าล่าสุดเสมอ
    this.notificationsService.load().subscribe({
      next: (list) => {
        this.notificationCount = list.length;
        this.cdr.detectChanges();
      },
      error: () => {
        // แจ้งเตือนดึงไม่ได้ก็ไม่ต้องขึ้นตัวเลข ไม่ใช่ฟีเจอร์หลักของไซด์บาร์
      }
    });
  }

  isDarkTheme() {
    return this.themeService.isDark();
  }

  toggleTheme() {
    this.themeService.toggle();
  }

  // เรียงตามความสำคัญ/ความถี่ในการใช้งาน: ดู-ตรวจสอบประจำวันไว้บนสุด (หน้าหลัก
  // เข้าก่อนเสมอ ตามด้วยแจ้งเตือน/สถานะอุปกรณ์/นัดตรวจสุขภาพที่ต้องเช็คบ่อย)
  // ส่วนเมนูตั้งค่า/เพิ่มข้อมูล (คอก ผังฟาร์ม อุปกรณ์ วัคซีน มาตรฐานฟาร์ม) ซึ่งทำ
  // เป็นครั้งคราวไว้ท้ายสุด
  menuItems: MenuItem[] = [
    { label: 'หน้าหลัก',                  icon: 'assets/images/logo.png',    route: '/home' },
    { label: 'การแจ้งเตือน',              svgIcon: 'notification',           route: '/notifications' },
    // ✅ เดิมลิงก์ไปหน้า "ระบบเซนเซอร์" ที่ให้เลือกคอกก่อนถึงจะเห็นอุปกรณ์ - เปลี่ยน
    // เป็นหน้าสรุปอุปกรณ์รวมทั้งฟาร์มเลย (ไม่ต้องเลือกคอก) ให้ตรงกับแอปมือถือ
    { label: 'สถานะการทำงานของอุปกรณ์',   icon: 'assets/images/esp32.png',   route: '/device-summary' },
    // ✅ การบันทึกไข่ไก่/ตรวจสุขภาพ/ให้วัคซีน "ของคอกไหน" ย้ายไปอยู่ใต้หน้า
    // "ข้อมูลคอกไก่" ทั้งหมดแล้ว (ดึง coop context ตรงนั้นได้เลย ไม่ต้องเลือกคอก
    // ซ้ำอีกรอบ) เมนูนี้เปลี่ยนเป็น "นัดตรวจสุขภาพ" แทน - หน้ารวมทั้งฟาร์มที่
    // คำนวณ/เลือกวันนัดตรวจก่อนเข้าไปบันทึกผลจริง
    { label: 'นัดตรวจสุขภาพ',             svgIcon: 'health',                 route: '/health-appointments' },
    { label: 'เพิ่มคอกไก่',               icon: 'assets/images/chicken.png', route: '/add-coop' },
    { label: 'จัดวางผังฟาร์ม',            icon: 'assets/images/coopchicken.png', route: '/farm-layout' },
    { label: 'เพิ่มอุปกรณ์',              icon: 'assets/images/esp32.png',   route: '/arrange' },
    // ✅ นี่คือหน้าเพิ่ม "ประเภท" วัคซีน/ยาใหม่เข้าระบบ (ไม่ผูกกับคอกไหน) ส่วน
    // การ "ให้วัคซีน" คอกใดคอกหนึ่งจริงๆ ย้ายไปกดจากหน้า "ข้อมูลคอกไก่" แทน
    { label: 'เพิ่มประเภทวัคซีน/ยา',      icon: 'assets/images/Vaccine.png', route: '/add-vaccine' },
    // ✅ เดิมลิงก์ไปหน้า "/setup" ซึ่งจริงๆคือหน้าลากวางอุปกรณ์บนแคนวาส (ขั้นตอน
    // ย่อยของ "เพิ่มอุปกรณ์" ต้องมี coop context ก่อน) ไม่ใช่หน้าตั้งค่าอุณหภูมิ
    // เลย - ตอนกดจากตรงนี้ตรงๆจึงเจอหน้าคนละเรื่องและพังเพราะไม่มี coop context
    // ชื่อเมนูก็เปลี่ยนให้ตรงกับหัวข้อของหน้าจริง ("ตั้งค่ามาตรฐานของฟาร์ม")
    { label: 'ตั้งค่ามาตรฐานของฟาร์ม',     icon: 'assets/images/temp.png',    route: '/farm-thresholds' },
  ];

  currentUsername(): string | null {
    return this.authService.currentUser()?.username ?? null;
  }

  logout() {
    this.close();
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  toggle() {
    this.isOpen.update(v => !v);
  }

  close() {
    this.isOpen.set(false);
  }

  goBack() {
    this.location.back();
  }
}
