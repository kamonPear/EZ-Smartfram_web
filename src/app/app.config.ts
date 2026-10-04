import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './services/auth.interceptor';

// เติม /api ไว้ที่นี่ที่เดียวเลยครับ
// ⚠️ ชั่วคราว: ชี้ไปที่ backend local เพราะ production (Render) ยังไม่ได้ redeploy
// โค้ดล่าสุด - ยังไม่มีทั้งระบบล็อกอิน (/api/auth/login จะ 404) และ
export const API_BASE_URL = 'https://ez-smartfarm-backn.onrender.com/api';
// export const API_BASE_URL = 'http://localhost:8080/api';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes)
  ]
};