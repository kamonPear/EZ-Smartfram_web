import { Observable, forkJoin, map, of, catchError } from 'rxjs';
import { ApiService } from '../services/api.service';
import { formatChickenAge } from './coop-summary.util';
import { formatDateKey } from './calendar-markers.util';

// ไก่ที่รับเข้าฟาร์มตอนโตแล้ว - วัคซีนบางตัว (หรือทุกตัว) ที่ช่วงอายุที่ควรให้จบไปก่อนวันรับเข้าฟาร์ม
// ระบบจะไม่แจ้งให้ฉีด เพราะไก่ควรได้รับวัคซีนช่วงนั้นมาจากฟาร์มเดิมแล้ว (เงื่อนไขเดียวกับ backend:
// GetVaccineCalendarAlertsHandler ใน handlers/vaccine.go ข้ามวัคซีนที่ วันเกิด + max_age_days < วันรับเข้าเลี้ยง)
// ผลคือคอกนี้อาจไม่มีวัคซีนที่ต้องให้ และไม่มีนัดตรวจสุขภาพก่อนให้วัคซีน - ตัวช่วยนี้สรุปข้อมูลไว้แสดงให้
// เจ้าของฟาร์มเข้าใจว่าทำไมกรอบว่าง ไม่ใช่ข้อมูลหาย

export interface VaccineSchedule {
  name: string;
  min_age_days: number;
  max_age_days: number;
}

export interface ArrivalVaccineNote {
  arrivalAge: string;   // อายุไก่ตอนรับเข้าฟาร์ม เช่น "9 เดือน 5 วัน"
  arrivalDate: Date;
  missed: string[];     // ชื่อวัคซีนที่เลยช่วงอายุไปก่อนรับเข้าฟาร์ม
  allMissed: boolean;   // true = เลยช่วงของวัคซีนทุกตัวที่ตั้งไว้
}

// คืน null ถ้าไม่มีวัคซีนตัวไหนเลยช่วงอายุก่อนรับเข้าฟาร์ม (ไก่มาตอนเล็ก) หรือข้อมูลวันที่ไม่ครบ
export function arrivalVaccineNote(
  birthday: Date | string | null | undefined,
  arrivalDate: Date | string | null | undefined,
  schedules: VaccineSchedule[],
): ArrivalVaccineNote | null {
  if (!birthday || !arrivalDate || schedules.length === 0) return null;
  const birth = new Date(birthday);
  const arrival = new Date(arrivalDate);
  if (isNaN(birth.getTime()) || isNaN(arrival.getTime())) return null;

  const arrivalKey = formatDateKey(arrival);
  const missed = schedules
    .filter(s => {
      const windowEnd = new Date(birth);
      windowEnd.setDate(windowEnd.getDate() + (s.max_age_days || 0));
      return formatDateKey(windowEnd) < arrivalKey;
    })
    .map(s => s.name);
  if (missed.length === 0) return null;

  return {
    arrivalAge: formatChickenAge(birth, arrival),
    arrivalDate: arrival,
    missed,
    allMissed: missed.length === schedules.length,
  };
}

// โหลดข้อมูลคอก + ประเภทวัคซีนของฟาร์ม แล้วสรุปเป็น ArrivalVaccineNote (ใช้ในป็อบอัพตรวจสุขภาพ/ให้วัคซีน)
// โหลดไม่สำเร็จ -> null (แค่ไม่แสดงข้อความอธิบาย ไม่กระทบการทำงานหลักของหน้า)
export function loadArrivalVaccineNote(api: ApiService, coopId: string | number): Observable<ArrivalVaccineNote | null> {
  return forkJoin({
    coop: api.get<any>(`/coops?id=${coopId}`),
    schedules: api.get<VaccineSchedule[]>('/vaccines/schedule'),
  }).pipe(
    map(({ coop, schedules }) => arrivalVaccineNote(coop?.birthday, coop?.date_adopt_animals, schedules || [])),
    catchError(() => of(null)),
  );
}
