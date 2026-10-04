import { Injectable, signal, inject } from '@angular/core';
import { AuthService } from './auth.service';

const STORAGE_KEY = 'ez_theme_mode';

// จำธีมแยกเป็นรายบัญชี (ต่อท้าย key ด้วย username) ไม่ใช่ key เดียวใช้ร่วมกันทุก
// บัญชีในเบราว์เซอร์นี้ - เดิมใช้ key ตายตัว ทำให้สลับบัญชีไปมาบนเครื่อง/เบราว์เซอร์
// เดียวกัน (เช่นตอนทดสอบหลาย user) ธีมของอีกบัญชีติดตามมาด้วยทั้งที่คนละบัญชีกัน
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private auth = inject(AuthService);
  isDark = signal(true);

  private key(): string {
    const user = this.auth.currentUser();
    return user ? `${STORAGE_KEY}_${user.username}` : STORAGE_KEY;
  }

  load() {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(this.key());
    } catch {
      // localStorage อาจใช้ไม่ได้ (เช่น private mode) - ใช้ค่าเริ่มต้น (มืด) แทน
    }
    this.apply(saved !== 'light');
  }

  toggle() {
    this.apply(!this.isDark());
    try {
      localStorage.setItem(this.key(), this.isDark() ? 'dark' : 'light');
    } catch {
      // ไม่ต้องทำอะไรถ้าเซฟไม่ได้ - ธีมยังสลับได้ปกติ แค่ไม่จำค่าไว้
    }
  }

  private apply(dark: boolean) {
    this.isDark.set(dark);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }
}
