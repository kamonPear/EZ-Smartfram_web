import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './services/auth.interceptor';

// เติม /api ไว้ที่นี่ที่เดียวเลยครับ
// ⚠️ ชั่วคราว: ชี้ไปที่ backend local เพราะ production (Render) ยังไม่ได้ redeploy
// โค้ดล่าสุด - ยังไม่มีทั้งระบบล็อกอิน (/api/auth/login จะ 404) และ
// /api/farm-layout, /api/coops/positions (ยืนยันแล้วด้วย curl วันที่ 2026-09-23)
// ถ้าชี้ไป Render ตอนนี้จะล็อกอินไม่ได้เลยและจัดวางผังฟาร์มก็บันทึกไม่ได้ด้วย
// สลับกลับไปบรรทัดล่างเมื่อ redeploy แล้ว (อย่าลืมตั้ง env var JWT_SECRET บน Render ด้วย)
export const API_BASE_URL = 'http://localhost:8080/api';
// export const API_BASE_URL = 'https://ez-smartfarm-backn.onrender.com/api';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes)
  ]
};