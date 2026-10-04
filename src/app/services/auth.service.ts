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
// เก็บ token/user ไว้ในหน่วยความจำ (field ของ service) เท่านั้น ไม่เขียนลง
// localStorage - ตั้งใจให้หายทุกครั้งที่รีเฟรช/เปิดหน้าเว็บใหม่ เพื่อบังคับให้
// ต้องล็อกอินใหม่เสมอ (ระหว่างใช้งานไม่ reload หน้า ยังใช้งานต่อได้ปกติ เพราะ
// Angular service เป็น singleton อยู่แล้วตราบใดที่ไม่มีการโหลดหน้าใหม่)
@Injectable({ providedIn: 'root' })
export class AuthService {
  private base = API_BASE_URL;
  private token: string | null = null;
  private user: AuthUser | null = null;

  constructor(private http: HttpClient) {}

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.base}/auth/login`, { username, password })
      .pipe(tap((res) => this.setSession(res)));
  }

  private setSession(res: LoginResponse) {
    this.token = res.token;
    this.user = res.user;
  }

  logout() {
    this.token = null;
    this.user = null;
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
