import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';

// หน้าล็อกอิน - ไม่มีลิงก์ "สมัครสมาชิก"/"ลืมรหัสผ่าน" ตั้งใจ เพราะแอดมินเป็นคน
// สร้างบัญชีให้ผู้ใช้เองนอกระบบ (ดู AUTH_CONTRACT.md) หน้านี้จึงมีแค่ฟอร์ม
// ชื่อผู้ใช้/รหัสผ่านล้วนๆ
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './Login.html',
  styleUrls: ['./Login.scss']
})
export class LoginComponent {
  username = '';
  password = '';
  showPassword = false;

  isSubmitting = false;
  errorMessage = '';

  constructor(
    private auth: AuthService,
    private theme: ThemeService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {
    // หน้า login ไม่มี username ให้ผูกธีมด้วย (ยังไม่ login) รีเซ็ตกลับค่าเริ่มต้น
    // เสมอ กันธีมของบัญชีก่อนหน้า (ที่เพิ่ง logout มา) ค้างโชว์อยู่ที่หน้านี้
    this.theme.resetToDefault();
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  submit() {
    const username = this.username.trim();
    const password = this.password;

    if (!username || !password) {
      this.errorMessage = 'กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน';
      return;
    }

    this.errorMessage = '';
    this.isSubmitting = true;

    this.auth.login(username, password).subscribe({
      next: () => {
        // ✅ โหลดธีมของ username นี้ใหม่ทันทีที่ login สำเร็จ - จำเป็นเพราะ sidebar
        // (ที่ปกติเป็นคนเรียก theme.load() ตอน ngOnInit) เป็น layout shell ที่ถูก
        // สร้างขึ้นแค่ครั้งเดียวต่อแท็บ ไม่ได้ re-mount ทุกครั้งที่ login ใหม่ ถ้าไม่
        // เรียกตรงนี้ซ้ำ ธีมของบัญชีก่อนหน้าในแท็บเดียวกันจะค้างอยู่ข้ามบัญชี
        this.theme.load();
        const redirect = this.route.snapshot.queryParamMap.get('redirect');
        // กัน redirect ที่ชี้กลับมาหน้า login เอง (เช่นจาก 401 ที่ยิงตอนยังไม่ล็อกอิน)
        // ไม่งั้นล็อกอินผ่านแล้วแต่ยังค้างอยู่หน้าเดิม
        const target = redirect && !redirect.startsWith('/login') ? redirect : '/home';
        // ✅ replaceUrl: true - แทนที่ entry ของหน้า login ใน history แทนที่จะ push
        // ซ้อนเข้าไปใหม่ กันกดปุ่มย้อนกลับ (back) ของเบราว์เซอร์แล้วเด้งกลับมาเจอ
        // ฟอร์ม login อีกรอบทั้งที่ยัง login ค้างอยู่จริง (session ยังไม่หมดอายุ)
        this.router.navigateByUrl(target, { replaceUrl: true });
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting = false;
        if (err.status === 401) {
          this.errorMessage = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
        } else if (err.status === 400) {
          this.errorMessage = 'ข้อมูลที่กรอกไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง';
        } else {
          this.errorMessage = 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
        }
        this.cdr.detectChanges();
      }
    });
  }
}
