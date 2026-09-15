import { formatDateKey } from './calendar-markers.util';

// นัดตรวจสุขภาพที่เจ้าของฟาร์มกำหนดวันเอง (หน้า "นัดตรวจสุขภาพ" โหมด "นัดตรวจสุขภาพเอง")
// ไม่มีตารางฝั่ง backend รองรับ (มีแค่วัคซีนที่คำนวณนัดอัตโนมัติได้) จึงเก็บไว้ใน
// localStorage ฝั่งนี้เอง แล้วเอาไปรวมกับนัดที่คำนวณจากวัคซีนตอนหาว่า "วันนัดตรวจ
// ถัดไปของคอกนี้คือวันไหน" (Add_health.computeNearestAppointment, Data_coop.healthAppointment)
// และตอนขึ้นมาร์คในปฏิทิน (calendar-markers.util)
export interface ManualHealthAppointment {
  coopId: number;
  date: string; // YYYY-MM-DD
}

const STORAGE_KEY = 'ez_manual_health_appointments';

function readAll(): ManualHealthAppointment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: ManualHealthAppointment[] = raw ? JSON.parse(raw) : [];
    // ทิ้งนัดที่วันผ่านไปแล้ว - พอถึงวันนัดจริงมันก็กลายเป็นการตรวจตามปกติไปแล้ว
    // ไม่ใช่ "นัดล่วงหน้า" ที่ต้องรออีกต่อไป
    const todayKey = formatDateKey(new Date());
    return list.filter(a => a && a.date >= todayKey);
  } catch {
    return [];
  }
}

function writeAll(list: ManualHealthAppointment[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // localStorage ใช้ไม่ได้ (โหมดส่วนตัว ฯลฯ) - ไม่ critical ปล่อยผ่าน
  }
}

export function addManualHealthAppointment(coopId: number, dateKey: string): void {
  const list = readAll();
  if (list.some(a => a.coopId === coopId && a.date === dateKey)) return;
  list.push({ coopId, date: dateKey });
  writeAll(list);
}

export function getManualHealthAppointments(coopId?: number | null): ManualHealthAppointment[] {
  const list = readAll();
  return coopId != null ? list.filter(a => a.coopId === coopId) : list;
}

export function removeManualHealthAppointment(coopId: number, dateKey: string): void {
  writeAll(readAll().filter(a => !(a.coopId === coopId && a.date === dateKey)));
}
