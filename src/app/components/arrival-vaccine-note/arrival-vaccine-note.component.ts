import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ArrivalVaccineNote } from '../../shared/arrival-vaccine.util';

// กล่องอธิบาย "ทำไมคอกนี้ไม่มีวัคซีน/นัดตรวจสุขภาพ" สำหรับไก่ที่รับเข้าฟาร์มตอนโตแล้ว
// ใช้ในกรอบตรวจสุขภาพ/วัคซีนของหน้าข้อมูลคอก และในป็อบอัพตรวจสุขภาพ/ให้วัคซีน
//   context = 'vaccine' -> อธิบายว่าทำไมไม่มีวัคซีนต้องให้
//   context = 'health'  -> อธิบายว่าทำไมไม่มีนัดตรวจสุขภาพก่อนให้วัคซีน
@Component({
  selector: 'app-arrival-vaccine-note',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="arrival-note" *ngIf="note">
      <span class="arrival-note-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
      </span>
      <div class="arrival-note-body">
        <strong>รับไก่เข้าฟาร์มเมื่อ {{ thaiDate(note.arrivalDate) }} ตอนอายุ {{ note.arrivalAge }}</strong>
        <ng-container *ngIf="note.allMissed; else partial">
          <p *ngIf="context === 'vaccine'">
            ไก่อายุเกินช่วงของวัคซีนทุกตัวที่ตั้งไว้แล้ว วัคซีนแต่ละช่วงอายุไก่ควรได้รับมาจากฟาร์มเดิมก่อนย้ายเข้ามา
            ระบบจึงไม่แจ้งให้ฉีดวัคซีนซ้ำ
          </p>
          <p *ngIf="context === 'health'">
            ไก่อายุเกินช่วงที่ต้องตรวจสุขภาพเพื่อให้วัคซีนแล้ว (วัคซีนแต่ละช่วงอายุควรได้รับมาจากฟาร์มเดิม)
            จึงไม่มีนัดตรวจสุขภาพอัตโนมัติ ถ้าต้องการตรวจ ตั้งนัดเองได้ที่หน้านัดตรวจสุขภาพ
          </p>
        </ng-container>
        <ng-template #partial>
          <p>
            ข้ามวัคซีน {{ note.missed.join(', ') }} เพราะไก่อายุเกินช่วงที่ควรให้ตั้งแต่ก่อนเข้าฟาร์ม
            (ควรได้รับมาจากฟาร์มเดิมแล้ว)
          </p>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .arrival-note {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      text-align: left;
      padding: 12px 14px;
      margin: 4px 0 12px;
      border-radius: 14px;
      background: rgba(59, 130, 246, 0.08);
      border: 1px solid rgba(59, 130, 246, 0.28);
      color: var(--text-title);
    }
    .arrival-note-icon {
      flex: 0 0 auto;
      width: 20px;
      height: 20px;
      margin-top: 1px;
      color: #3b82f6;
      svg { width: 100%; height: 100%; }
    }
    .arrival-note-body {
      font-size: 0.8rem;
      line-height: 1.55;
      strong { display: block; font-weight: 700; margin-bottom: 2px; }
      p { margin: 0; color: rgba(var(--fg-rgb), 0.7); }
    }
  `],
})
export class ArrivalVaccineNoteComponent {
  @Input() note: ArrivalVaccineNote | null = null;
  @Input() context: 'vaccine' | 'health' = 'vaccine';

  thaiDate(d: Date): string {
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
