import { AfterViewInit, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

// ช่องค้นหามีไอคอนแว่นขยาย ใช้ร่วมกันทุกหน้า - ผูกค่าแบบ [query] + (queryChange) ให้หน้า
// ที่เรียกใช้เก็บคำค้นเองและกรองรายการของหน้านั้น (ไม่ยิง API ใหม่ กรองจากข้อมูลที่โหลดไว้แล้ว)
@Component({
  selector: 'app-search-box',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="search-box" role="search">
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        #field
        type="search"
        [value]="query"
        [placeholder]="placeholder"
        [attr.aria-label]="placeholder"
        (input)="onInput($event)"
        autocomplete="off">
      <button type="button" class="search-clear" *ngIf="query" (click)="clear()" aria-label="ล้างคำค้นหา">&times;</button>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; max-width: 460px; }
    .search-box {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 14px;
      height: 44px;
      border-radius: 999px;
      background-color: var(--bg-card);
      border: 1px solid var(--border-strong);
      font-family: 'Kanit', sans-serif;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .search-box:focus-within {
      border-color: var(--accent-green-bright, #72d572);
      box-shadow: 0 0 0 3px rgba(114, 213, 114, 0.18);
    }
    .search-icon { width: 20px; height: 20px; flex-shrink: 0; color: var(--text-secondary); }
    input {
      flex: 1;
      min-width: 0;
      background: transparent;
      border: none;
      outline: none;
      color: var(--text-primary);
      font-family: inherit;
      font-size: 0.95rem;
    }
    input::placeholder { color: var(--text-secondary); }
    input::-webkit-search-cancel-button { display: none; }
    .search-clear {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      font-size: 1.4rem;
      line-height: 1;
      cursor: pointer;
      padding: 0 2px;
    }
    .search-clear:hover { color: var(--text-primary); }
  `]
})
export class SearchBox implements AfterViewInit {
  @Input() query = '';
  // true = ย้ายเคอร์เซอร์ไปที่ช่องพิมพ์ทันทีที่แสดง (ใช้ตอนเปิดช่องค้นหารวมจากปุ่มแว่นขยาย)
  @Input() autofocus = false;
  @ViewChild('field') private field?: ElementRef<HTMLInputElement>;
  @Input() placeholder = 'ค้นหา';
  @Output() queryChange = new EventEmitter<string>();

  ngAfterViewInit() {
    if (this.autofocus) this.field?.nativeElement.focus();
  }

  onInput(event: Event) {
    this.queryChange.emit((event.target as HTMLInputElement).value);
  }

  clear() {
    this.queryChange.emit('');
  }
}
