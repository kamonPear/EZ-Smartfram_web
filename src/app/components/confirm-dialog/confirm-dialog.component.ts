import { Component, HostListener, inject } from '@angular/core';
import { ConfirmService } from '../../services/confirm.service';

// ตัวป็อบอัพยืนยันก่อนบันทึก (ใช้คู่กับ ConfirmService) - วางไว้ใน app.html ครั้งเดียว
// โชว์เมื่อมีหน้าไหนเรียก confirm.ask(...) และส่งคำตอบ (ยืนยัน/ยกเลิก) กลับไปให้หน้านั้น
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    @if (confirm.current(); as c) {
      <div class="cd-overlay" (click)="confirm.answer(false)">
        <div class="cd-box" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="cd-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg>
          </div>
          <h3>{{ c.title }}</h3>
          <p>{{ c.message }}</p>
          @if (c.details?.length) {
            <ul class="cd-details">
              @for (d of c.details; track $index) { <li>{{ d }}</li> }
            </ul>
          }
          <div class="cd-actions">
            <button type="button" class="btn-cancel" (click)="confirm.answer(false)">{{ c.cancelText }}</button>
            <button type="button" class="btn-confirm" (click)="confirm.answer(true)">{{ c.confirmText }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .cd-overlay {
      position: fixed; inset: 0; z-index: 3000;
      background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(2px);
      display: flex; align-items: center; justify-content: center; padding: 16px;
    }
    .cd-box {
      font-family: 'Kanit', sans-serif;
      background: var(--bg-card); border: 1px solid var(--border-strong);
      border-radius: 20px; box-shadow: 0 15px 30px rgba(0, 0, 0, 0.4);
      width: 420px; max-width: 100%; padding: 28px 28px 24px; text-align: center;
      animation: cd-pop 0.22s ease-out;
    }
    .cd-icon {
      width: 52px; height: 52px; margin: 0 auto 12px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: rgba(114, 213, 114, 0.15); color: var(--accent-green-bright);
    }
    .cd-icon svg { width: 28px; height: 28px; }
    h3 { margin: 0 0 8px; color: var(--text-primary, var(--text-title)); font-size: 1.3rem; font-weight: 700; }
    p { margin: 0 0 14px; color: var(--text-secondary); font-size: 0.98rem; line-height: 1.6; }
    .cd-details {
      list-style: none; margin: 0 0 18px; padding: 12px 16px; text-align: left;
      background: var(--bg-card-alt, rgba(255, 255, 255, 0.04)); border-radius: 12px;
      color: var(--text-primary, var(--text-title)); font-size: 0.92rem; line-height: 1.7;
      max-height: 40vh; overflow-y: auto;
    }
    .cd-actions { display: flex; gap: 12px; }
    @keyframes cd-pop { from { transform: scale(0.94); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  `]
})
export class ConfirmDialogComponent {
  confirm = inject(ConfirmService);

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.confirm.current()) this.confirm.answer(false);
  }
}
