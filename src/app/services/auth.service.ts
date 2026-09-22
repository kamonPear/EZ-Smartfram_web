import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../app.config';

export interface AuthUser {
  id: number;
  username: string;
  role: 'admin' | 'user';
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

const TOKEN_KEY = 'ez_auth_token';
const USER_KEY = 'ez_auth_user';

// ล็อกอินเข้าระบบ - ตาม AUTH_CONTRACT.md (endpoint อยู่ใต้ /api/auth/*, token เป็น
// JWT ส่งแบบ Authorization: Bearer <token>) ไม่มีหน้าสมัครสมาชิกเอง เพราะแอดมิน
// เป็นคนสร้างบัญชีให้เองนอกระบบ (ดู contract)
@Injectable({ providedIn: 'root' })
export class AuthService {
  private base = API_BASE_URL;

  constructor(private http: HttpClient) {}

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.base}/auth/login`, { username, password })
      .pipe(tap((res) => this.setSession(res)));
  }

  private setSession(res: LoginResponse) {
    try {
      localStorage.setItem(TOKEN_KEY, res.token);
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    } catch {
      // localStorage อาจใช้ไม่ได้ (เช่น private mode) - session จะไม่ persist ข้าม
      // reload แต่ล็อกอินรอบนี้ยังใช้งานต่อได้จนกว่าจะปิดแท็บ
    }
  }

  logout() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      // ไม่ต้องทำอะไรถ้าเคลียร์ไม่ได้
    }
  }

  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  currentUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }
}
