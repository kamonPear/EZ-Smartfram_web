import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { ApiService } from './api.service';
import { NotificationsService } from './notifications.service';
import { HealthAppointmentService } from './health-appointment.service';
import { Coop } from '../shared/coop-summary.util';
import { matchesQuery, normalizeQuery } from '../shared/search.util';

// ค้นหารวมทั้งเว็บ: โหลดข้อมูลจากทุกส่วนของระบบมาทำเป็นรายการเดียว (ดัชนี) แล้วค้นในเครื่อง -
// ใช้ร่วมกันทั้งช่องค้นหาที่หน้าแรกและหน้า "ค้นหา" เต็มหน้า ไม่ต้องเขียนตรรกะค้นซ้ำสองที่
export const SEARCH_GROUPS = [
  'คอกไก่',
  'อุปกรณ์',
  'ไข่ไก่',
  'ตรวจสุขภาพ',
  'วัคซีนที่ให้แล้ว',
  'ประเภทวัคซีน/ยา',
  'นัดตรวจสุขภาพ',
  'การแจ้งเตือน',
  'ประวัติอาหาร',
  'เมนู',
] as const;
export type SearchGroup = typeof SEARCH_GROUPS[number];

export interface SearchItem {
  group: SearchGroup;
  title: string;
  subtitle?: string;
  route: string;
  // มีค่าเมื่อผลลัพธ์เป็นของคอกใดคอกหนึ่ง - กดแล้วเปิดหน้า "ข้อมูลคอกไก่" ของคอกนั้นโดยตรง
  coopId?: number;
  // ข้อความทั้งหมดที่ค้นเจอได้ของรายการนี้ (นอกเหนือจาก title/subtitle ที่แสดง)
  haystack: Array<string | number | null | undefined>;
}

const PAGES: { label: string; route: string; keywords?: string }[] = [
  { label: 'หน้าหลัก', route: '/home' },
  { label: 'ค้นหา', route: '/search' },
  { label: 'การแจ้งเตือน', route: '/notifications' },
  { label: 'สถานะการทำงานของอุปกรณ์และเซนเซอร์', route: '/device-summary', keywords: 'เซนเซอร์ บอร์ด ESP32 ออนไลน์ ออฟไลน์' },
  { label: 'นัดตรวจสุขภาพ', route: '/health-appointments' },
  { label: 'คลังอาหาร', route: '/food', keywords: 'อาหาร สต็อก เม็ดเล็ก เม็ดใหญ่' },
  { label: 'เพิ่มสต็อกอาหาร', route: '/add-food', keywords: 'นำเข้าอาหาร' },
  { label: 'เพิ่มคอกไก่', route: '/add-coop' },
  { label: 'คอกไก่ทั้งหมด', route: '/coop-list' },
  { label: 'จัดวางผังฟาร์ม', route: '/farm-layout' },
  { label: 'วางอุปกรณ์เซนเซอร์', route: '/arrange', keywords: 'จัดวาง' },
  { label: 'เพิ่มอุปกรณ์ (ชนิดอุปกรณ์)', route: '/add-device-type', keywords: 'เซนเซอร์ใหม่' },
  { label: 'เพิ่มประเภทวัคซีน/ยา', route: '/add-vaccine', keywords: 'วัคซีน ยา' },
  { label: 'ตั้งค่ามาตรฐานของฟาร์ม', route: '/farm-thresholds', keywords: 'อุณหภูมิ แอมโมเนีย' },
  { label: 'สำรองข้อมูล (Backup)', route: '/backup', keywords: 'backup แบ็คอัพ ดาวน์โหลด ส่งออก ไฟล์ json csv' },
];

function thaiDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function isoDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

@Injectable({ providedIn: 'root' })
export class SiteSearchService {
  constructor(
    private api: ApiService,
    private notifications: NotificationsService,
    private appointments: HealthAppointmentService,
    private router: Router
  ) {}

  /** โหลดข้อมูลทุกส่วนแล้วประกอบเป็นรายการค้นหา - แหล่งไหนโหลดไม่ได้ก็ข้ามเฉพาะแหล่งนั้น */
  buildIndex(): Observable<SearchItem[]> {
    const safe = <T>(source: Observable<T>, fallback: T) =>
      source.pipe(catchError(() => of(fallback)));

    return forkJoin({
      coops: safe(this.api.get<Coop[]>('/coops'), [] as Coop[]),
      notifications: safe(this.notifications.load(), []),
      imports: safe(this.api.get<any[]>('/food_history'), [] as any[]),
      distributions: safe(this.api.get<any[]>('/foods/distribution'), [] as any[]),
      schedules: safe(this.api.get<any[]>('/vaccines/schedule'), [] as any[]),
      appointments: safe(this.appointments.list(), [] as any[]),
    }).pipe(
      map(({ coops, notifications, imports, distributions, schedules, appointments }) => {
        const items: SearchItem[] = [];
        const coopName = (c: Coop) => c.name_coop || `คอกที่ ${c.coop_id}`;
        const nameById = new Map<number, string>();
        (coops || []).forEach(c => nameById.set(c.coop_id, coopName(c)));

        for (const c of coops || []) {
          const name = coopName(c);
          items.push({
            group: 'คอกไก่', title: name, subtitle: `${c.amount ?? 0} ตัว`, route: '/data-coop', coopId: c.coop_id,
            haystack: [name, c.coop_id, `${c.amount} ตัว`, thaiDate(c.birthday), isoDate(c.birthday)],
          });
          for (const d of c.devices ?? []) {
            items.push({
              group: 'อุปกรณ์', title: d.name,
              subtitle: `${name} · ${d.current_status === 'Online' ? 'ออนไลน์' : 'ออฟไลน์'}`,
              route: '/data-coop', coopId: c.coop_id,
              haystack: [d.name, d.device_type, d.current_status === 'Online' ? 'ออนไลน์ ทำงานอยู่' : 'ออฟไลน์', name,
                d.slot_index != null ? `หมายเลข ${d.slot_index}` : ''],
            });
          }
          for (const e of c.eggs ?? []) {
            items.push({
              group: 'ไข่ไก่', title: `${e.number_egg} ฟอง`, subtitle: `${name} · ${thaiDate(e.date_collect_egg)}`,
              route: '/data-coop', coopId: c.coop_id,
              haystack: [`ไข่ ${e.number_egg} ฟอง`, e.number_egg, name, e.note, thaiDate(e.date_collect_egg), isoDate(e.date_collect_egg)],
            });
          }
          for (const h of c.health ?? []) {
            items.push({
              group: 'ตรวจสุขภาพ', title: `สุขภาพดี ${h.healthy} · ป่วย ${h.poor_health}`,
              subtitle: `${name} · ${thaiDate(h.record_date)}`, route: '/data-coop', coopId: c.coop_id,
              haystack: ['ตรวจสุขภาพ', `สุขภาพดี ${h.healthy}`, `ป่วย ${h.poor_health}`, name, h.note, thaiDate(h.record_date), isoDate(h.record_date)],
            });
          }
          for (const v of c.vaccine_history ?? []) {
            items.push({
              group: 'วัคซีนที่ให้แล้ว', title: v.name, subtitle: `${name} · ${thaiDate(v.record_date)}`,
              route: '/data-coop', coopId: c.coop_id,
              haystack: [v.name, v.method, v.note, name, thaiDate(v.record_date), isoDate(v.record_date)],
            });
          }
        }

        for (const s of schedules || []) {
          items.push({
            group: 'ประเภทวัคซีน/ยา', title: s.name, subtitle: `${s.method ? s.method + ' · ' : ''}อายุ ${s.min_age_days}–${s.max_age_days} วัน`,
            route: '/add-vaccine', haystack: [s.name, s.method, s.description, `${s.min_age_days}-${s.max_age_days} วัน`],
          });
        }

        for (const a of appointments || []) {
          const name = nameById.get(a.coop_id) ?? `คอกที่ ${a.coop_id}`;
          items.push({
            group: 'นัดตรวจสุขภาพ', title: `นัดตรวจ – ${name}`, subtitle: thaiDate(a.appointment_date),
            route: '/health-appointments',
            haystack: ['นัดตรวจ', 'นัดตรวจสุขภาพ', name, thaiDate(a.appointment_date), isoDate(a.appointment_date)],
          });
        }

        for (const n of notifications || []) {
          items.push({
            group: 'การแจ้งเตือน', title: n.title, subtitle: n.coopName, route: '/notifications',
            haystack: [n.title, n.coopName, n.type === 'vaccine' ? 'วัคซีน' : n.type === 'health' ? 'สุขภาพ' : n.type === 'food' ? 'อาหาร' : 'ความเคลื่อนไหว'],
          });
        }

        for (const row of imports || []) {
          const date = row.import_date;
          items.push({
            group: 'ประวัติอาหาร', title: `นำเข้า ${row.food_type || '-'} ${Number(row.import_volume) || 0} กก.`,
            subtitle: thaiDate(date), route: '/food',
            haystack: ['นำเข้าอาหาร', row.food_type, row.import_volume, thaiDate(date), isoDate(date)],
          });
        }
        for (const row of distributions || []) {
          const date = row.distributed_at;
          items.push({
            group: 'ประวัติอาหาร', title: `นำออก ${row.food_type || '-'} ${Number(row.kg_given) || 0} กก.`,
            subtitle: thaiDate(date), route: '/food',
            haystack: ['นำออกอาหาร แจกจ่าย', row.food_type, row.kg_given, thaiDate(date), isoDate(date)],
          });
        }

        for (const p of PAGES) {
          items.push({ group: 'เมนู', title: p.label, route: p.route, haystack: [p.label, p.keywords] });
        }
        return items;
      })
    );
  }

  /** กรองรายการตามคำค้น (คืนว่างถ้ายังไม่ได้พิมพ์) */
  search(index: SearchItem[], query: string): SearchItem[] {
    if (!normalizeQuery(query)) return [];
    return index.filter(item => matchesQuery(query, item.title, item.subtitle, item.group, ...item.haystack));
  }

  /** เปิดหน้าที่เกี่ยวข้องกับผลลัพธ์ (ถ้าเป็นของคอกใดคอกหนึ่งเปิด "ข้อมูลคอกไก่" ของคอกนั้น) */
  open(item: SearchItem) {
    if (item.coopId != null) {
      this.router.navigate(['/data-coop'], { state: { coopNumber: String(item.coopId) } });
    } else {
      this.router.navigateByUrl(item.route);
    }
  }
}
