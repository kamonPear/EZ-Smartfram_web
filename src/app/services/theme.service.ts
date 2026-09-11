import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'ez_theme_mode';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  isDark = signal(true);

  load() {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      // localStorage อาจใช้ไม่ได้ (เช่น private mode) - ใช้ค่าเริ่มต้น (มืด) แทน
    }
    this.apply(saved !== 'light');
  }

  toggle() {
    this.apply(!this.isDark());
    try {
      localStorage.setItem(STORAGE_KEY, this.isDark() ? 'dark' : 'light');
    } catch {
      // ไม่ต้องทำอะไรถ้าเซฟไม่ได้ - ธีมยังสลับได้ปกติ แค่ไม่จำค่าไว้
    }
  }

  private apply(dark: boolean) {
    this.isDark.set(dark);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }
}
