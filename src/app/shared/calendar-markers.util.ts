import { forkJoin, map, Observable } from 'rxjs';
import { ApiService } from '../services/api.service';

export interface DayMarker {
  /** 'due' = at least one vaccine alert for that day is not yet completed (or overdue); 'done' = all completed */
  vaccineStatus?: 'done' | 'due';
  /** a health record exists on that day (informational only - no due/overdue concept exists for health checks) */
  hasHealth?: boolean;
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
