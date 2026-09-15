import { forkJoin, map, Observable } from 'rxjs';
import { ApiService } from '../services/api.service';
import { getManualHealthAppointments } from './manual-health-appointment.util';

export interface DayMarker {
  /** 'due' = at least one vaccine alert for that day is not yet completed (or overdue); 'done' = all completed */
  vaccineStatus?: 'done' | 'due';
  /** a health record exists on that day (informational only - no due/overdue concept exists for health checks) */
  hasHealth?: boolean;
  /** วันเกิดไก่ หรือวันที่รับเข้าเลี้ยงของคอก - ข้อมูลทั่วไป ไม่มีสถานะเกินกำหนด/
   *  ยังไม่ทำ เหมือนวัคซีน แค่บอกว่า "วันนี้เกี่ยวอะไรกับคอกนี้บ้าง" */
  hasCoopInfo?: boolean;
  /** มีนัดตรวจสุขภาพที่กำหนดวันเอง (โหมด "นัดตรวจสุขภาพเอง") ตกอยู่วันนี้ - ยังไม่ถึงวันตรวจจริง */
  hasHealthAppointment?: boolean;
  /** human-readable lines shown in the day's tooltip */
  details: string[];
}

interface VaccineAlert {
  date: string; // YYYY-MM-DD
  coop_id: string;
  vaccine_name: string;
  is_completed: boolean;
  is_overdue: boolean;
}

interface HealthRow {
  coop_id: number;
  record_date: string; // ISO
}

interface CoopLite {
  coop_id: number;
  name_coop: string;
  birthday?: string | null;
  date_adopt_animals?: string | null;
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildMarkerMap(
  alerts: VaccineAlert[],
  health: HealthRow[],
  coops: CoopLite[],
  coopId?: number | null
): Map<string, DayMarker> {
  const map = new Map<string, DayMarker>();
  const coopName = (id: number | string) =>
    coops.find(c => c.coop_id === Number(id))?.name_coop || `คอกที่ ${id}`;

  const relevantAlerts = coopId ? alerts.filter(a => Number(a.coop_id) === coopId) : alerts;
  for (const a of relevantAlerts) {
    const entry = map.get(a.date) || { details: [] };
    if (!a.is_completed) {
      entry.vaccineStatus = 'due';
    } else if (entry.vaccineStatus !== 'due') {
      entry.vaccineStatus = 'done';
    }
    const label = a.is_completed ? 'ให้แล้ว' : (a.is_overdue ? 'เกินกำหนด' : 'ถึงกำหนด');
    entry.details.push(`วัคซีน${a.vaccine_name} – ${coopName(a.coop_id)} (${label})`);
    map.set(a.date, entry);
  }

  const relevantHealth = coopId ? health.filter(h => Number(h.coop_id) === coopId) : health;
  for (const h of relevantHealth) {
    const d = new Date(h.record_date);
    if (isNaN(d.getTime())) continue;
    const key = formatDateKey(d);
    const entry = map.get(key) || { details: [] };
    entry.hasHealth = true;
    entry.details.push(`ตรวจสุขภาพ – ${coopName(h.coop_id)}`);
    map.set(key, entry);
  }

  // วันเกิดไก่ + วันที่รับเข้าเลี้ยงของคอก - นับเป็น "วันที่เกี่ยวกับคอกนี้"
  // ด้วยเหมือนกัน ไม่ใช่แค่วัคซีน/สุขภาพ
  const relevantCoops = coopId ? coops.filter(c => c.coop_id === coopId) : coops;
  for (const c of relevantCoops) {
    if (c.birthday) {
      const d = new Date(c.birthday);
      if (!isNaN(d.getTime())) {
        const key = formatDateKey(d);
        const entry = map.get(key) || { details: [] };
        entry.hasCoopInfo = true;
        entry.details.push(`🎂 วันเกิดไก่ – ${coopName(c.coop_id)}`);
        map.set(key, entry);
      }
    }
    if (c.date_adopt_animals) {
      const d = new Date(c.date_adopt_animals);
      if (!isNaN(d.getTime())) {
        const key = formatDateKey(d);
        const entry = map.get(key) || { details: [] };
        entry.hasCoopInfo = true;
        entry.details.push(`🏠 วันที่รับเข้าเลี้ยง – ${coopName(c.coop_id)}`);
        map.set(key, entry);
      }
    }
  }

  // นัดตรวจสุขภาพที่กำหนดวันเอง (เก็บไว้ใน localStorage - ไม่มีจาก backend)
  const manualAppointments = getManualHealthAppointments(coopId ?? null);
  for (const m of manualAppointments) {
    const entry = map.get(m.date) || { details: [] };
    entry.hasHealthAppointment = true;
    entry.details.push(`🗓️ นัดตรวจสุขภาพ (กำหนดเอง) – ${coopName(m.coopId)}`);
    map.set(m.date, entry);
  }

  return map;
}

/** Loads vaccine-alert + health-record data once and shapes it into a day marker map for the calendar. */
export function loadCalendarMarkers(api: ApiService, coopId?: number | null): Observable<Map<string, DayMarker>> {
  return forkJoin({
    alerts: api.get<VaccineAlert[]>('/vaccines/alerts'),
    health: api.get<HealthRow[]>('/healths'),
    coops: api.get<CoopLite[]>('/coops'),
  }).pipe(
    map(({ alerts, health, coops }) => buildMarkerMap(alerts || [], health || [], coops || [], coopId))
  );
}
