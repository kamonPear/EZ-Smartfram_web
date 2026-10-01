import { map, Observable } from 'rxjs';
import { ApiService } from '../services/api.service';

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

// รูปร่างที่ backend ส่งมาจริง (snake_case ตามธรรมเนียม backend) - แปลงเป็น
// camelCase ของ DayMarker ด้านบนตรงนี้ที่เดียว ไม่ต้องแก้ทุกหน้าที่ใช้ DayMarker อยู่แล้ว
// details เป็น object โครงสร้าง (text/category/status/coop_id) เผื่อฝั่งแอป Flutter
// เอาไปเรนเดอร์ไอคอน/สีต่อ item ได้ - ฝั่งเว็บแค่เอา .text ไปต่อกันเป็น string[] เหมือนเดิม
interface BackendDayMarkerDetail {
  text: string;
  category: string;
  status: string;
  coop_id: number;
}

interface BackendDayMarker {
  vaccine_status?: 'done' | 'due';
  has_health?: boolean;
  has_coop_info?: boolean;
  has_health_appointment?: boolean;
  details: BackendDayMarkerDetail[];
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * ดึงปฏิทินรวม (วัคซีน/สุขภาพ/วันเกิด-วันรับเข้าเลี้ยง/นัดตรวจสุขภาพกำหนดเอง)
 * จาก backend endpoint เดียว (/api/calendar/markers) - เดิมหน้านี้ต้องยิง 3 คำขอ
 * แยก (vaccines/alerts, healths, coops) แล้วรวมเองฝั่ง frontend เอง ย้ายมาคำนวณที่
 * backend จุดเดียวแทน เพื่อให้เว็บกับแอปมือถือเห็นผลลัพธ์ตรงกันเป๊ะ ไม่ต้องคง logic
 * การรวมสองที่ให้ตรงกันเอง
 */
export function loadCalendarMarkers(api: ApiService, coopId?: number | null): Observable<Map<string, DayMarker>> {
  const query = coopId != null ? `?coop_id=${coopId}` : '';
  return api.get<Record<string, BackendDayMarker>>(`/calendar/markers${query}`).pipe(
    map(response => {
      const result = new Map<string, DayMarker>();
      for (const [key, m] of Object.entries(response || {})) {
        result.set(key, {
          vaccineStatus: m.vaccine_status,
          hasHealth: m.has_health,
          hasCoopInfo: m.has_coop_info,
          hasHealthAppointment: m.has_health_appointment,
          details: (m.details || []).map(d => d.text),
        });
      }
      return result;
    })
  );
}
