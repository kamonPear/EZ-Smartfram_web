import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// กันทุกหน้ายกเว้น /login - ถ้ายังไม่ได้ล็อกอินให้เด้งไปหน้า login พร้อมจำ path
// ที่พยายามเข้าไว้ใน query param `redirect` เพื่อกลับมาที่เดิมได้หลังล็อกอินสำเร็จ
export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  return router.createUrlTree(['/login'], { queryParams: { redirect: state.url } });
};
