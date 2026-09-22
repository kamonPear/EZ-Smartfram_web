import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

// แนบ Authorization: Bearer <token> ไปกับทุก request ที่ยิงออก (ถ้ามี token อยู่)
// และถ้า backend ตอบ 401 กลับมา (token ไม่มี/หมดอายุ/ไม่ถูกต้อง - ดู
// AUTH_CONTRACT.md) ให้เคลียร์ session แล้วเด้งกลับไปหน้า login พร้อมจำ path
// เดิมไว้ใน query param `redirect` เผื่อกลับมาที่เดิมได้หลังล็อกอินใหม่
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const token = authService.getToken();
  const authedReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authedReq).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        authService.logout();
        const current = router.routerState.snapshot.url;
        // เทียบเฉพาะ path (ตัด query ทิ้ง) ไม่ใช่ทั้ง url - ถ้าเทียบทั้ง url
        // ตอนอยู่ที่ /login?redirect=/home มันจะไม่ถือว่าเป็นหน้า login แล้ว
        // เอา url เดิมทั้งก้อนมายัดเป็น redirect ซ้อนเข้าไปอีกชั้นทุกครั้งที่เจอ 401
        const onLoginPage = current.split('?')[0] === '/login';
        router.navigate(['/login'], {
          queryParams: current && !onLoginPage ? { redirect: current } : {}
        });
      }
      return throwError(() => err);
    })
  );
};
