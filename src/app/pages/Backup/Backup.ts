import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Observable, catchError, forkJoin, of } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { HealthAppointmentService } from '../../services/health-appointment.service';
import { Coop } from '../../shared/coop-summary.util';
import { ExportTable, buildSql, buildXlsx, createZip } from '../../shared/backup-export.util';
import { buildPdf } from '../../shared/backup-pdf.util';

type BackupFormat = 'sql' | 'xlsx' | 'pdf' | 'zip';

interface BackupCategory {
  key: string;
  icon: string;
  label: string;
  description: string;
  // null = โหลดข้อมูลส่วนนี้ไม่สำเร็จ (ยังเลือกสำรองไม่ได้)
  rows: Record<string, unknown>[] | null;
  // รูปแบบของข้อมูลในไฟล์ JSON (ถ้าไม่ระบุใช้ rows ตรงๆ)
  json?: unknown;
  selected: boolean;
}

interface BackupHistoryEntry {
  time: string; // ISO
  categories: string[];
  records: number;
  fileName: string;
  sizeKb: number;
}

const HISTORY_KEY_PREFIX = 'ez_backup_history_';
const HISTORY_LIMIT = 8;

// หน้า "สำรองข้อมูล (Backup)" - ดาวน์โหลดข้อมูลฟาร์มของผู้ใช้เก็บไว้เป็นไฟล์ในเครื่อง (JSON ทั้งชุดตาม
// หมวดที่เลือก หรือ CSV ต่อหมวด เปิดใน Excel ได้) ดึงจาก API ชุดเดียวกับที่เว็บใช้อยู่ ไม่ได้เก็บไฟล์ไว้ที่
// เซิร์ฟเวอร์ ประวัติด้านล่างจึงบันทึกเฉพาะในเบราว์เซอร์เครื่องนี้ (ไม่ใช่ตัวไฟล์)
@Component({
  selector: 'app-backup',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './Backup.html',
  styleUrls: ['./Backup.scss']
})
export class BackupPageComponent implements OnInit {
  isLoading = true;
  // รูปแบบไฟล์ที่เลือก: SQL / Excel / ทั้งสองรูปแบบรวมเป็น ZIP
  format: BackupFormat = 'sql';
  readonly formats: { value: BackupFormat; title: string; ext: string; desc: string }[] = [
    { value: 'sql', title: 'SQL', ext: '.sql', desc: 'สคริปต์ที่ restore ได้' },
    { value: 'xlsx', title: 'Excel', ext: '.xlsx', desc: 'หนึ่ง sheet ต่อหนึ่งตาราง' },
    { value: 'pdf', title: 'PDF', ext: '.pdf', desc: 'รายงานอ่านง่าย พิมพ์ได้' },
    { value: 'zip', title: 'ทุกรูปแบบ', ext: '.zip', desc: 'รวม SQL, Excel และ PDF ในไฟล์ ZIP' },
  ];
  categories: BackupCategory[] = [];
  history: BackupHistoryEntry[] = [];

  // หมวดที่ลบทิ้งได้หลังสำรอง (ตรงกับ purgeableCategories ฝั่ง backend) - หมวดอื่น (คอก ประเภทวัคซีน/ยา
  // คลังอาหาร ค่ามาตรฐาน) เป็นข้อมูลหลักของระบบ เก็บไว้เสมอ ไม่เสนอให้ลบ
  private readonly purgeableKeys = ['devices', 'eggs', 'health', 'vaccine_history', 'appointments'];

  // หน้าต่างถามหลังสำรองเสร็จ: "เก็บไว้" หรือ "ลบข้อมูลนี้" (null = ไม่แสดง)
  afterBackup: { fileName: string; deletable: { key: string; label: string; count: number }[]; kept: string[] } | null = null;
  purgeStep: 'ask' | 'confirm' = 'ask';
  confirmChecked = false;
  isPurging = false;

  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private appointments: HealthAppointmentService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.history = this.loadHistory();
    this.load();
  }

  // ---------- โหลดข้อมูลทุกหมวด ----------
  load() {
    this.isLoading = true;
    const safe = <T>(source: Observable<T>) => source.pipe(catchError(() => of(null as T | null)));

    forkJoin({
      coops: safe(this.api.get<Coop[]>('/coops')),
      schedules: safe(this.api.get<any[]>('/vaccines/schedule')),
      appointments: safe(this.appointments.list()),
      stock: safe(this.api.get<any[]>('/foods')),
      imports: safe(this.api.get<any[]>('/food_history')),
      distributions: safe(this.api.get<any[]>('/foods/distribution')),
      threshold: safe(this.api.get<any>('/farm-threshold')),
    }).subscribe((res) => {
      const coops = res.coops;
      const nameOf = (c: Coop) => c.name_coop || `คอกที่ ${c.coop_id}`;
      const fromCoops = (pick: (c: Coop) => any[] | undefined, map: (c: Coop, r: any) => Record<string, unknown>) =>
        coops ? coops.flatMap((c) => (pick(c) ?? []).map((r) => map(c, r))) : null;

      const foodReady = res.stock && res.imports && res.distributions;
      const foodRows = foodReady
        ? [
            ...res.stock!.map((s: any) => ({ รายการ: 'สต็อกคงเหลือ', ประเภทอาหาร: s.food_type, ปริมาณ_กก: s.quantity ?? s.stock ?? s.amount, ใกล้หมด_กก: s.threshold })),
            ...res.imports!.map((i: any) => ({ รายการ: 'นำเข้า', ประเภทอาหาร: i.food_type, ปริมาณ_กก: i.import_volume, วันที่: i.import_date })),
            ...res.distributions!.map((d: any) => ({ รายการ: 'นำออก', ประเภทอาหาร: d.food_type, ปริมาณ_กก: d.kg_given, วันที่: d.distributed_at, คอก: d.coop_id })),
          ]
        : null;

      this.categories = [
        { key: 'coops', icon: '🏠', label: 'คอกไก่', description: 'ชื่อคอก จำนวนไก่ วันเกิดไก่ วันรับเข้าเลี้ยง หมายเหตุ ตำแหน่งบนผังฟาร์ม', selected: false,
          rows: coops ? coops.map((c: any) => ({ coop_id: c.coop_id, name_coop: c.name_coop, amount: c.amount, birthday: c.birthday, date_adopt_animals: c.date_adopt_animals, note: c.note, pos_x: c.pos_x, pos_y: c.pos_y })) : null },
        { key: 'devices', icon: '📡', label: 'อุปกรณ์ / เซนเซอร์', description: 'อุปกรณ์ที่วางไว้ในแต่ละคอก ชนิด หมายเลข ตำแหน่งบนผัง', selected: false,
          rows: fromCoops((c) => c.devices, (c, d: any) => ({ coop_id: c.coop_id, name_coop: nameOf(c), slot_index: d.slot_index, name: d.name, device_type: d.device_type, pos_x: d.pos_x, pos_y: d.pos_y })) },
        { key: 'eggs', icon: '🥚', label: 'ข้อมูลไข่ไก่', description: 'จำนวนไข่ที่เก็บได้ในแต่ละวันของทุกคอก', selected: false,
          rows: fromCoops((c) => c.eggs, (c, e: any) => ({ coop_id: c.coop_id, name_coop: nameOf(c), date_collect_egg: e.date_collect_egg, number_egg: e.number_egg, note: e.note })) },
        { key: 'health', icon: '🩺', label: 'ประวัติตรวจสุขภาพ', description: 'ผลตรวจสุขภาพไก่ (จำนวนไก่ดี/ป่วย) ของทุกคอก', selected: false,
          rows: fromCoops((c) => c.health, (c, h: any) => ({ coop_id: c.coop_id, name_coop: nameOf(c), record_date: h.record_date, healthy: h.healthy, poor_health: h.poor_health, note: h.note })) },
        { key: 'vaccine_history', icon: '💉', label: 'วัคซีนที่ให้แล้ว', description: 'ประวัติการให้วัคซีน/ยาของแต่ละคอก', selected: false,
          rows: fromCoops((c) => c.vaccine_history, (c, v: any) => ({ coop_id: c.coop_id, name_coop: nameOf(c), name: v.name, method: v.method, record_date: v.record_date, note: v.note })) },
        { key: 'vaccine_types', icon: '📋', label: 'ประเภทวัคซีน/ยา', description: 'รายการวัคซีน/ยาที่ตั้งไว้ พร้อมช่วงอายุที่ให้', selected: false,
          rows: res.schedules ? res.schedules.map((s: any) => ({ name: s.name, method: s.method, min_age_days: s.min_age_days, max_age_days: s.max_age_days, description: s.description })) : null },
        { key: 'appointments', icon: '📅', label: 'นัดตรวจสุขภาพ', description: 'วันนัดตรวจสุขภาพที่กำหนดเอง', selected: false,
          rows: res.appointments ? res.appointments.map((a: any) => ({ coop_id: a.coop_id, appointment_date: a.appointment_date })) : null },
        { key: 'food', icon: '🌾', label: 'คลังอาหาร', description: 'สต็อกคงเหลือ ประวัตินำเข้า และนำออก/แจกจ่ายอาหาร', selected: false, rows: foodRows },
        { key: 'threshold', icon: '🌡️', label: 'ค่ามาตรฐานของฟาร์ม', description: 'อุณหภูมิและแอมโมเนียมาตรฐาน', selected: false,
          rows: res.threshold ? [{ temperature: res.threshold.temperature, ammonia: res.threshold.ammonia }] : null },
      ];
      this.isLoading = false;
      this.cdr.detectChanges();
    });
  }

  // ---------- เลือก/สรุป ----------
  get selectedCategories(): BackupCategory[] {
    return this.categories.filter((c) => c.selected && c.rows !== null);
  }

  get selectedRecordCount(): number {
    return this.selectedCategories.reduce((sum, c) => sum + (c.rows?.length ?? 0), 0);
  }

  get allSelected(): boolean {
    const usable = this.categories.filter((c) => c.rows !== null);
    return usable.length > 0 && usable.every((c) => c.selected);
  }

  toggleAll() {
    const next = !this.allSelected;
    this.categories.forEach((c) => (c.selected = c.rows !== null && next));
  }

  get lastBackup(): BackupHistoryEntry | null {
    return this.history[0] ?? null;
  }

  // ---------- ดาวน์โหลด ----------
  get formatExt(): string {
    return this.formats.find((f) => f.value === this.format)?.ext ?? '';
  }

  isBuilding = false;

  async backupSelected() {
    if (this.isBuilding) return;
    const picked = this.selectedCategories;
    if (picked.length === 0) {
      this.flashToast('กรุณาเลือกข้อมูลที่ต้องการสำรองอย่างน้อย 1 หมวด', 'error');
      return;
    }
    const now = new Date();
    const tables: ExportTable[] = picked.map((c) => ({ name: c.key, sheetName: c.label, rows: c.rows ?? [] }));
    const base = `ez-smartfarm-backup-${this.stamp(now)}`;
    const exportedBy = this.auth.currentUser()?.username ?? null;

    let fileName: string;
    let blob: Blob;
    this.isBuilding = true;
    this.cdr.detectChanges();
    try {
      const pdfMeta = { title: 'รายงานสำรองข้อมูลฟาร์ม EZ-SmartFarm', exportedAt: now, exportedBy };
      if (this.format === 'sql') {
        fileName = `${base}.sql`;
        blob = new Blob([buildSql(tables, { exportedAt: now, exportedBy })], { type: 'application/sql;charset=utf-8' });
      } else if (this.format === 'xlsx') {
        fileName = `${base}.xlsx`;
        blob = new Blob([buildXlsx(tables, now) as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      } else if (this.format === 'pdf') {
        fileName = `${base}.pdf`;
        blob = new Blob([(await buildPdf(tables, pdfMeta)) as BlobPart], { type: 'application/pdf' });
      } else {
        fileName = `${base}.zip`;
        const sql = new TextEncoder().encode(buildSql(tables, { exportedAt: now, exportedBy }));
        const zip = createZip(
          [
            { name: `${base}.sql`, data: sql },
            { name: `${base}.xlsx`, data: buildXlsx(tables, now) },
            { name: `${base}.pdf`, data: await buildPdf(tables, pdfMeta) },
          ],
          now
        );
        blob = new Blob([zip as BlobPart], { type: 'application/zip' });
      }
    } catch (err) {
      console.error('สร้างไฟล์สำรองข้อมูลไม่สำเร็จ:', err);
      this.isBuilding = false;
      this.flashToast('สร้างไฟล์สำรองข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error');
      return;
    }
    this.isBuilding = false;
    this.download(blob, fileName);

    this.pushHistory({
      time: now.toISOString(),
      categories: picked.map((c) => c.label),
      records: this.selectedRecordCount,
      fileName,
      sizeKb: Math.max(1, Math.round(blob.size / 1024)),
    });
    this.flashToast(`สำรองข้อมูลสำเร็จ (${picked.length} หมวด ${this.selectedRecordCount} รายการ)`);

    // ถามต่อว่าจะลบข้อมูลที่เพิ่งสำรองออกจากระบบเลย หรือเก็บไว้
    this.afterBackup = {
      fileName,
      deletable: picked
        .filter((c) => this.purgeableKeys.includes(c.key) && (c.rows?.length ?? 0) > 0)
        .map((c) => ({ key: c.key, label: c.label, count: c.rows?.length ?? 0 })),
      kept: picked.filter((c) => !this.purgeableKeys.includes(c.key)).map((c) => c.label),
    };
    this.purgeStep = 'ask';
    this.confirmChecked = false;
  }

  // ---------- หลังสำรองเสร็จ: เก็บไว้ / ลบ ----------
  keepData() {
    this.afterBackup = null;
    this.purgeStep = 'ask';
    this.confirmChecked = false;
  }

  startDelete() {
    this.purgeStep = 'confirm';
    this.confirmChecked = false;
  }

  backToAsk() {
    this.purgeStep = 'ask';
    this.confirmChecked = false;
  }

  get deletableTotal(): number {
    return this.afterBackup?.deletable.reduce((sum, d) => sum + d.count, 0) ?? 0;
  }

  confirmDelete() {
    if (!this.afterBackup || !this.confirmChecked || this.isPurging) return;
    const categories = this.afterBackup.deletable.map((d) => d.key);
    if (categories.length === 0) return;

    this.isPurging = true;
    this.api.post<{ deleted: Record<string, number> }>('/data/purge', { categories }).subscribe({
      next: (res) => {
        this.isPurging = false;
        const total = Object.values(res?.deleted ?? {}).reduce((s, n) => s + n, 0);
        this.afterBackup = null;
        this.purgeStep = 'ask';
        this.confirmChecked = false;
        this.flashToast(`ลบข้อมูลที่สำรองไว้แล้ว ${total} รายการ`);
        this.load();
      },
      error: (err) => {
        this.isPurging = false;
        console.error('ลบข้อมูลหลังสำรองไม่สำเร็จ:', err);
        this.flashToast('ลบข้อมูลไม่สำเร็จ ข้อมูลยังอยู่ครบ กรุณาลองใหม่อีกครั้ง', 'error');
      }
    });
  }

  // CSV ของหมวดเดียว - เปิดใน Excel ได้ (ใส่ BOM ให้ภาษาไทยไม่เพี้ยน)
  downloadCsv(category: BackupCategory, event: Event) {
    event.stopPropagation();
    if (!category.rows || category.rows.length === 0) {
      this.flashToast('หมวดนี้ยังไม่มีข้อมูลให้ดาวน์โหลด', 'error');
      return;
    }
    const columns = Array.from(new Set(category.rows.flatMap((r) => Object.keys(r))));
    const cell = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [columns.join(','), ...category.rows.map((r) => columns.map((c) => cell(r[c])).join(','))];
    const fileName = `ez-smartfarm-${category.key}-${this.stamp(new Date())}.csv`;
    this.download(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), fileName);
    this.flashToast(`ดาวน์โหลด ${category.label} (CSV) แล้ว`);
  }

  private download(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  private stamp(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  }

  // ---------- ประวัติ (เก็บในเบราว์เซอร์เครื่องนี้ แยกตามผู้ใช้) ----------
  private historyKey(): string {
    return HISTORY_KEY_PREFIX + (this.auth.currentUser()?.username ?? 'guest');
  }

  private loadHistory(): BackupHistoryEntry[] {
    try {
      const raw = localStorage.getItem(this.historyKey());
      return raw ? (JSON.parse(raw) as BackupHistoryEntry[]) : [];
    } catch {
      return [];
    }
  }

  private pushHistory(entry: BackupHistoryEntry) {
    this.history = [entry, ...this.history].slice(0, HISTORY_LIMIT);
    try {
      localStorage.setItem(this.historyKey(), JSON.stringify(this.history));
    } catch {
      // เขียนไม่ได้ (เช่นโหมดส่วนตัว) - ไฟล์ดาวน์โหลดแล้วอยู่ดี แค่ไม่มีประวัติ
    }
  }

  clearHistory() {
    this.history = [];
    try {
      localStorage.removeItem(this.historyKey());
    } catch {
      // ไม่ต้องทำอะไร
    }
  }

  formatDateTime(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? ''
      : d.toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  private flashToast(message: string, type: 'success' | 'error' = 'success') {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.showToast = false;
      this.cdr.detectChanges();
    }, 2800);
  }
}
