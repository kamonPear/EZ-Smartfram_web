import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../services/api.service';

interface VaccineAlertRow {
  id: string;
  vaccineName: string;
  method: string;
  date: Date;
  isCompleted: boolean;
  daysUntil: number;
}

// หน้า "ให้วัคซีน" ของคอกเดียว - ตามกำหนดที่คำนวณจาก medicine_schedules (ประเภท
// วัคซีนที่ตั้งไว้ใน "เพิ่มประเภทวัคซีน/ยา") เทียบกับอายุไก่ของคอกนี้ กดให้วัคซีน
// แล้วเพื่อบันทึกลงประวัติวัคซีนของคอก - คล้ายปุ่ม "ตรวจสุขภาพ" แต่วัคซีนอิงตาม
// ตารางที่ตั้งไว้แทนการกรอกเองอิสระ (ตรงกับคอนเซปของแอปมือถือ)
@Component({
  selector: 'app-give-vaccine',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './Give_vaccine.html',
  styleUrls: ['./Give_vaccine.scss']
})
export class GiveVaccineComponent {
  coopId: string | null = null;
  coopName = '';
  isLoading = true;
  alerts: VaccineAlertRow[] = [];
  savingId: string | null = null;

  constructor(private route: ActivatedRoute, private api: ApiService, private cdr: ChangeDetectorRef) {
    this.coopId = this.route.snapshot.queryParamMap.get('coop_id');
    this.fetchAlerts();
  }

  fetchAlerts() {
    if (!this.coopId) {
      this.isLoading = false;
      return;
    }
    this.isLoading = true;
    forkJoin({
      coop: this.api.get<any>(`/coops?id=${this.coopId}`),
      alerts: this.api.get<any[]>('/vaccines/alerts'),
    }).subscribe({
      next: ({ coop, alerts }) => {
        this.coopName = coop?.name_coop || `คอกที่ ${this.coopId}`;

        const rows: VaccineAlertRow[] = [];
        const today = new Date();
        const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        for (const a of alerts || []) {
          if (String(a?.coop_id) !== String(this.coopId)) continue;
          if (!a?.date) continue;
          const d = new Date(a.date);
          if (isNaN(d.getTime())) continue;
          const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          rows.push({
            id: a.id,
            vaccineName: a.vaccine_name || 'วัคซีน',
            method: a.injection_type || '-',
            date: dateOnly,
            isCompleted: a.is_completed === true,
            daysUntil: Math.round((dateOnly.getTime() - todayOnly.getTime()) / 86400000),
          });
        }

        // วันล่าสุดขึ้นก่อน วันเก่าไปอยู่ล่างสุด
        rows.sort((x, y) => y.date.getTime() - x.date.getTime());
        this.alerts = rows;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('โหลดข้อมูลวัคซีนไม่สำเร็จ:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  statusLabel(a: VaccineAlertRow): string {
    if (a.isCompleted) return 'ให้แล้ว';
    if (a.daysUntil < 0) return `เลยกำหนดมา ${-a.daysUntil} วัน`;
    if (a.daysUntil === 0) return 'ถึงกำหนดวันนี้';
    if (a.daysUntil === 1) return 'พรุ่งนี้ถึงกำหนด';
    return `อีก ${a.daysUntil} วัน`;
  }

  statusClass(a: VaccineAlertRow): string {
    if (a.isCompleted) return 'is-done';
    if (a.daysUntil <= 0) return 'is-danger';
    if (a.daysUntil === 1) return 'is-warning';
    return 'is-ok';
  }

  formatDate(d: Date): string {
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  markGiven(a: VaccineAlertRow) {
    if (a.isCompleted || this.savingId) return;
    this.savingId = a.id;
    this.api.put(`/vaccines/alerts?id=${a.id}`, { is_completed: true }).subscribe({
      next: () => {
        this.savingId = null;
        this.fetchAlerts();
      },
      error: (err) => {
        console.error('บันทึกการให้วัคซีนไม่สำเร็จ:', err);
        this.savingId = null;
        this.cdr.detectChanges();
      }
    });
  }
}
