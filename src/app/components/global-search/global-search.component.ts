import { Component, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SiteSearchComponent } from '../site-search/site-search.component';

// ปุ่มแว่นขยายลอยมุมขวาบนของหน้าที่ไม่มีช่องค้นหารวมวางอยู่ในหน้าเอง - กดแล้วเปิดช่องค้นหา
// รวมทั้งเว็บ (ตัวเดียวกับที่วางอยู่ในหน้าอื่นๆ) ค้นเจอทุกอย่างไม่ว่าอยู่หน้าไหน
@Component({
  selector: 'app-global-search',
  standalone: true,
  imports: [CommonModule, SiteSearchComponent],
  template: `
    <button type="button" class="search-fab" *ngIf="!isOpen()" (click)="open()" aria-label="ค้นหา" title="ค้นหา">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    </button>

    <div class="search-backdrop" *ngIf="isOpen()" (click)="close()"></div>

    <div class="search-panel" *ngIf="isOpen()">
      <app-site-search [autofocus]="true" placeholder="ค้นหาทุกอย่างบนเว็บ" (done)="close()"></app-site-search>
    </div>
  `,
  styles: [`
    .search-fab {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 1500;
      width: 46px;
      height: 46px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      background-color: var(--bg-card);
      color: var(--text-primary);
      border: 1px solid var(--border-strong);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
      transition: transform 0.15s ease, border-color 0.15s ease;
    }
    .search-fab:hover { transform: scale(1.06); border-color: var(--accent-green-bright, #72d572); }
    .search-fab svg { width: 22px; height: 22px; }

    .search-backdrop { position: fixed; inset: 0; z-index: 1490; background: rgba(0, 0, 0, 0.35); }

    .search-panel {
      position: fixed;
      top: 14px;
      right: 16px;
      z-index: 1500;
      width: min(460px, calc(100vw - 32px));
    }
    .search-panel app-site-search { max-width: none; }
  `]
})
export class GlobalSearchComponent {
  isOpen = signal(false);

  open() {
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
  }

  // กด Esc ปิดช่องค้นหา
  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.isOpen()) this.close();
  }
}
