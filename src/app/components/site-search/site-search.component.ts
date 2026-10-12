import { Component, ChangeDetectorRef, ElementRef, HostListener, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SearchBox } from '../../shared/search-box/search-box';
import { normalizeQuery } from '../../shared/search.util';
import { SearchItem, SiteSearchService } from '../../services/site-search.service';

// ช่องค้นหารวมทั้งเว็บ - วางไว้หน้าไหนก็ได้ ค้นเจอทุกอย่างเหมือนกัน (คอก อุปกรณ์ ไข่ สุขภาพ
// วัคซีน นัดตรวจ แจ้งเตือน อาหาร และเมนู) พิมพ์แล้วมีรายการผลลัพธ์ลอยลงมา กดไปหน้านั้นได้เลย
@Component({
  selector: 'app-site-search',
  standalone: true,
  imports: [CommonModule, RouterModule, SearchBox],
  template: `
    <div class="site-search">
      <app-search-box
        [query]="query"
        [autofocus]="autofocus"
        (queryChange)="onQueryChange($event)"
        [placeholder]="placeholder">
      </app-search-box>

      <div class="search-results" *ngIf="hasQuery">
        <p class="search-empty" *ngIf="isLoading">กำลังค้นหา...</p>
        <ng-container *ngIf="!isLoading">
          <ng-container *ngIf="results.length > 0; else none">
            <button type="button" class="search-result-row" *ngFor="let r of results" (click)="pick(r)">
              <span class="result-group">{{ r.group }}</span>
              <span class="result-title">{{ r.title }}</span>
              <span class="result-subtitle" *ngIf="r.subtitle">{{ r.subtitle }}</span>
            </button>
            <a class="search-see-all" routerLink="/search" [queryParams]="{ q: query }" (click)="finish()">ดูผลทั้งหมดในหน้าค้นหา →</a>
          </ng-container>
          <ng-template #none>
            <p class="search-empty">ไม่พบผลการค้นหา "{{ query }}"</p>
          </ng-template>
        </ng-container>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; max-width: 460px; }
    .site-search { position: relative; width: 100%; font-family: 'Kanit', sans-serif; }
    .site-search app-search-box { max-width: none; }

    .search-results {
      position: absolute;
      top: 52px;
      left: 0;
      right: 0;
      z-index: 1400;
      max-height: 60vh;
      overflow-y: auto;
      background-color: var(--bg-card);
      border: 1px solid var(--border-strong);
      border-radius: 14px;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.4);
      padding: 6px;
    }
    .search-result-row {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 2px 10px;
      align-items: baseline;
      width: 100%;
      text-align: left;
      background: transparent;
      border: none;
      border-radius: 10px;
      padding: 8px 10px;
      cursor: pointer;
      font-family: inherit;
      color: var(--text-primary);
    }
    .search-result-row:hover { background-color: rgba(var(--fg-rgb), 0.08); }
    .result-group { grid-row: 1 / span 2; font-size: 0.7rem; font-weight: 600; color: var(--accent-green-bright, #72d572); min-width: 72px; }
    .result-title { font-size: 0.95rem; font-weight: 600; overflow-wrap: anywhere; }
    .result-subtitle { font-size: 0.8rem; color: var(--text-secondary); overflow-wrap: anywhere; }
    .search-empty { margin: 0; padding: 14px; text-align: center; color: var(--text-secondary); font-size: 0.9rem; }
    .search-see-all {
      display: block;
      text-align: center;
      padding: 10px;
      margin-top: 4px;
      color: var(--accent-green-bright, #72d572);
      font-size: 0.85rem;
      font-weight: 600;
      text-decoration: none;
      border-top: 1px solid var(--border-subtle);
    }
  `]
})
export class SiteSearchComponent {
  @Input() placeholder = 'ค้นหาทุกอย่างบนเว็บ (คอก อุปกรณ์ ไข่ วัคซีน อาหาร เมนู)';
  @Input() autofocus = false;
  // ยิงเมื่อผู้ใช้เลือกผลลัพธ์/ไปหน้าค้นหา - ให้ตัวที่ครอบอยู่ (เช่นปุ่มแว่นขยายลอย) ปิดตัวเองได้
  @Output() done = new EventEmitter<void>();

  query = '';
  isLoading = false;
  private index: SearchItem[] | null = null;
  private loadedAt = 0;
  // ข้อมูลเก่ากว่านี้ (มิลลิวินาที) ถือว่าล้าสมัย โหลดใหม่ตอนเริ่มพิมพ์รอบถัดไป
  private static readonly STALE_MS = 30_000;

  constructor(
    private search: SiteSearchService,
    private host: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef
  ) {}

  get hasQuery(): boolean {
    return normalizeQuery(this.query).length > 0;
  }

  get results(): SearchItem[] {
    if (!this.index) return [];
    return this.search.search(this.index, this.query).slice(0, 30);
  }

  onQueryChange(value: string) {
    this.query = value;
    if (!this.hasQuery) return;
    const stale = !this.index || Date.now() - this.loadedAt > SiteSearchComponent.STALE_MS;
    if (stale && !this.isLoading) this.loadIndex();
  }

  private loadIndex() {
    this.isLoading = true;
    this.search.buildIndex().subscribe({
      next: (index) => {
        this.index = index;
        this.loadedAt = Date.now();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  pick(item: SearchItem) {
    this.finish();
    this.search.open(item);
  }

  finish() {
    this.query = '';
    this.done.emit();
  }

  // กดนอกช่องค้นหา หรือกด Esc = ซ่อนรายการผลลัพธ์ (ล้างคำค้นด้วย)
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    if (this.query && !this.host.nativeElement.contains(event.target as Node)) {
      this.query = '';
      this.cdr.detectChanges();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.query) {
      this.query = '';
      this.cdr.detectChanges();
    }
  }
}
