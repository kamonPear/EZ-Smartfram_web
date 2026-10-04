import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../app.config';

export interface AuthUser {
  id: number;
  username: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

// ล็อกอินเข้าระบบ (endpoint อยู่ใต้ /api/auth/*, token เป็น JWT ส่งแบบ
// Authorization: Bearer <token>) ไม่มีหน้าสมัครสมาชิกเอง เพราะเจ้าของฟาร์มเป็นคน
// สร้างบัญชีให้เองผ่าน API โดยใช้ ADMIN_API_KEY - ในระบบไม่มี role ทุกบัญชีเท่ากันหมด
//
// เก็บ session ไว้ใน localStorage พร้อมเวลาหมดอายุ (SESSION_TTL_MS) - login ค้าง
// ไว้ได้ข้ามการรีเฟรช/ปิดเปิดแท็บใหม่ จนกว่าจะครบ 24 ชม. นับจากตอน login ถึงจะ
// บังคับให้ login ใหม่ (เดิมเคยตั้งใจให้ไม่ persist เลยเพื่อบังคับ login ทุกครั้งที่
// รีเฟรช แต่ผู้ใช้แจ้งว่าไม่สะดวก เลยเปลี่ยนมาเป็นจำไว้ 24 ชม. แทน)
const SESSION_STORAGE_KEY = 'ez_auth_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredSession {
  token: string;
  user: AuthUser;
  expiresAt: number; // epoch ms
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private base = API_BASE_URL;
  private token: string | null = null;
  private user: AuthUser | null = null;

  constructor(private http: HttpClient) {
    this.restoreSession();
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.base}/auth/login`, { username, password })
      .pipe(tap((res) => this.setSession(res)));
  }

  private setSession(res: LoginResponse) {
    this.token = res.token;
    this.user = res.user;
    const stored: StoredSession = {
      token: res.token,
      user: res.user,
      expiresAt: Date.now() + SESSION_TTL_MS,
    };
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // localStorage อาจใช้ไม่ได้ (เช่น private mode) - session จะใช้งานต่อได้
      // ปกติจนกว่าจะปิดแท็บ แค่ไม่ persist ข้ามการรีเฟรช
    }
  }

  // เรียกครั้งเดียวตอนสร้าง service (ตอนเปิด/รีเฟรชหน้าเว็บ) - กู้ session คืนจาก
  // localStorage ถ้ายังไม่หมดอายุ ถ้าหมดอายุแล้วให้ล้างทิ้งแล้วถือว่ายังไม่ login
  private restoreSession() {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(SESSION_STORAGE_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    try {
      const stored: StoredSession = JSON.parse(raw);
      if (stored.expiresAt > Date.now()) {
        this.token = stored.token;
        this.user = stored.user;
      } else {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  logout() {
    this.token = null;
    this.user = null;
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ไม่ต้องทำอะไรถ้าเคลียร์ไม่ได้
    }
  }

  getToken(): string | null {
    return this.token;
  }

  currentUser(): AuthUser | null {
    return this.user;
  }

  isLoggedIn(): boolean {
    return !!this.token;
  }
}
