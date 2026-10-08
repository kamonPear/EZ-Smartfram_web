import { Injectable } from '@angular/core';
import { forkJoin, map, Observable, of, catchError, Subject } from 'rxjs';
import { ApiService } from './api.service';

export type NotificationType = 'food' | 'vaccine' | 'health' | 'motion';

export interface FarmNotification {
  id: string;
  type: NotificationType;
  title: string;
  urgent: boolean;
  daysUntil: number;
  coopId?: string;
  coopName?: string;
  // เฉพาะ type === 'vaccine' - ส่งต่อไปตอนกด "เสร็จสิ้น" (PUT /vaccines/alerts)
  // เพื่อให้แถวประวัติที่บันทึกมี method/note ครบ ไม่ใช่ปล่อยว่างเหมือนเดิม
  method?: string;
  chickenAge?: number;
  description?: string;
  // เฉพาะ type === 'motion' - เวลา (ms) ของการตรวจจับล่าสุดที่รวมอยู่ในแจ้งเตือนนี้
  // ใช้ตอนกด "รับทราบ" เพื่อจำว่ารับทราบถึงเหตุการณ์ไหนแล้ว
  motionLastAt?: number;
}

// จำว่าผู้ใช้กด "รับทราบ" แจ้งเตือนความเคลื่อนไหวของแต่ละคอกถึงเวลาไหนแล้ว (เก็บใน
// เบราว์เซอร์นี้) - เหตุการณ์ที่เกิดก่อนหรือเท่ากับเวลานั้นจะไม่ถูกนับ/แจ้งซ้ำอีก แต่
// ถ้ามีการตรวจจับใหม่หลังจากนั้นจะแจ้งเตือนขึ้นมาใหม่ตามปกติ
const MOTION_ACK_KEY = 'ez_motion_ack';

function loadMotionAcks(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(MOTION_ACK_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

// เตือนล่วงหน้า 2 วันก่อนถึงกำหนด (ทั้งวัคซีนและตรวจสุขภาพ) ไปจนถึงเลยกำหนดแล้ว
// - พอร์ตมาจาก services/notifications_service.dart ของแอปมือถือ ให้ตรรกะตรงกัน
const ADVANCE_DAYS = 2;

function dateKey(d: Date): string {
  const y = String(d.getFullYear()).padStart(4, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  constructor(private api: ApiService) {}

  // ยิงทุกครั้งที่รายการแจ้งเตือนเปลี่ยนจากฝั่งผู้ใช้ (กดรับทราบ/เสร็จสิ้น) ให้ส่วนที่
  // แสดงจำนวนแจ้งเตือนค้างอยู่ (เช่นตัวเลขบนเมนูข้าง) โหลดค่าใหม่
  readonly changed$ = new Subject<void>();

  /** โหลดรายการแจ้งเตือนทั้งหมดของฟาร์ม (อาหารใกล้หมด/หมด, ใกล้ถึงกำหนดให้วัคซีน,
   *  ใกล้ถึงกำหนดตรวจสุขภาพก่อนให้วัคซีน) - ใช้ร่วมกันทั้งหน้า "การแจ้งเตือน" เอง
   *  และแถบเมนู (hamburger) ที่ต้องรู้แค่จำนวนไว้ขึ้นตัวเลขแจ้งเตือน */
  load(): Observable<FarmNotification[]> {
    return forkJoin({
      foods: this.api.get<any[]>('/foods').pipe(catchError(() => of([]))),
      coops: this.api.get<any[]>('/coops').pipe(catchError(() => of([]))),
      alerts: this.api.get<any[]>('/vaccines/alerts').pipe(catchError(() => of([]))),
      healths: this.api.get<any[]>('/healths').pipe(catchError(() => of([]))),
      motion: this.api.get<any[]>('/motion-alerts').pipe(catchError(() => of([]))),
    }).pipe(
      map(({ foods, coops, alerts, healths, motion }) =>
        this.build(foods || [], coops || [], alerts || [], healths || [], motion || []))
    );
  }

  /** บันทึกว่ารับทราบแจ้งเตือนความเคลื่อนไหวของคอกนี้แล้ว (ถึงเวลาตรวจจับล่าสุดที่ให้มา) */
  acknowledgeMotion(coopId: string, lastAt: number) {
    try {
      const acks = loadMotionAcks();
      acks[coopId] = Math.max(acks[coopId] || 0, lastAt);
      localStorage.setItem(MOTION_ACK_KEY, JSON.stringify(acks));
    } catch {
      // เขียน localStorage ไม่ได้ (โหมดส่วนตัว ฯลฯ) - ยอมให้แจ้งเตือนกลับมาตอนโหลดใหม่
    }
  }

  private build(foods: any[], coops: any[], alerts: any[], healths: any[], motion: any[] = []): FarmNotification[] {
    const notifications: FarmNotification[] = [];
    const today = new Date();
    const todayOnly = dateOnly(today);

    // 1. แจ้งเตือนปริมาณอาหาร (ใกล้หมด / หมดแล้ว)
    for (const row of foods) {
      const current = Number(row?.quantity_current ?? 0);
      const min = Number(row?.min_quantity ?? 0);
      const foodType = row?.food_type || 'อาหาร';
      const foodId = row?.food_id ?? 0;

      if (current <= 0) {
        notifications.push({
          id: `food_${foodId}`,
          type: 'food',
          title: `🚨 อาหาร${foodType}หมดแล้ว! กรุณาเติมอาหารด่วน`,
          urgent: true,
          daysUntil: -999,
        });
      } else if (current <= min) {
        notifications.push({
          id: `food_${foodId}`,
          type: 'food',
          title: `⚠️ อาหาร${foodType}ใกล้หมด (เหลือ ${current.toFixed(1)} กก.)`,
          urgent: false,
          daysUntil: -999,
        });
      }
    }

    // 2. เตรียมชื่อคอก + วันที่มีผลตรวจสุขภาพบันทึกไว้แล้ว (กันเตือนซ้ำ)
    const coopNames = new Map<string, string>();
    for (const c of coops) {
      const id = String(c?.coop_id ?? c?.id ?? '');
      coopNames.set(id, (c?.name_coop && String(c.name_coop).trim()) || `คอก ${id}`);
    }

    const checkedHealthDates = new Set<string>();
    for (const h of healths) {
      const coopId = h?.coop_id != null ? String(h.coop_id) : null;
      const d = h?.record_date ? new Date(h.record_date) : null;
      if (!coopId || !d || isNaN(d.getTime())) continue;
      checkedHealthDates.add(`${coopId}_${dateKey(d)}`);
    }

    // 3 + 4. แจ้งเตือนวัคซีน และแจ้งเตือนตรวจสุขภาพ (ก่อนให้วัคซีน 1 วันเสมอ)
    for (const a of alerts) {
      if (a?.is_completed === true) continue;
      if (!a?.date) continue;
      const dueDate = new Date(a.date);
      if (isNaN(dueDate.getTime())) continue;
      const dueOnly = dateOnly(dueDate);

      const coopId = a?.coop_id != null ? String(a.coop_id) : '-';
      const coopName = coopNames.get(coopId) || `คอก ${coopId}`;
      const vaccineName = a?.vaccine_name || 'วัคซีน';

      // --- แจ้งเตือนตรวจสุขภาพ (1 วันก่อนวันให้วัคซีนเสมอ) ---
      const healthCheckDate = new Date(dueOnly);
      healthCheckDate.setDate(healthCheckDate.getDate() - 1);
      const daysUntilHealthCheck = Math.round((healthCheckDate.getTime() - todayOnly.getTime()) / 86400000);
      const alreadyChecked = checkedHealthDates.has(`${coopId}_${dateKey(healthCheckDate)}`);

      if (!alreadyChecked && daysUntilHealthCheck <= ADVANCE_DAYS) {
        let healthTitle: string;
        if (daysUntilHealthCheck < 0) {
          healthTitle = `‼️ เลยกำหนดตรวจสุขภาพที่${coopName}ก่อนให้${vaccineName}มา ${-daysUntilHealthCheck} วันแล้ว`;
        } else if (daysUntilHealthCheck === 0) {
          healthTitle = `‼️ วันนี้ถึงกำหนดตรวจสุขภาพที่${coopName}ก่อนให้${vaccineName}`;
        } else if (daysUntilHealthCheck === 1) {
          healthTitle = `🩺 พรุ่งนี้ถึงกำหนดตรวจสุขภาพที่${coopName}ก่อนให้${vaccineName}`;
        } else {
          healthTitle = `🩺 อีก ${daysUntilHealthCheck} วันถึงกำหนดตรวจสุขภาพที่${coopName}ก่อนให้${vaccineName}`;
        }

        notifications.push({
          id: `health_${coopId}_${dateKey(healthCheckDate)}`,
          type: 'health',
          title: healthTitle,
          urgent: daysUntilHealthCheck <= 0,
          daysUntil: daysUntilHealthCheck,
          coopId,
          coopName,
        });
      }

      // --- แจ้งเตือนให้วัคซีน ---
      const daysUntilVaccine = Math.round((dueOnly.getTime() - todayOnly.getTime()) / 86400000);
      if (daysUntilVaccine > ADVANCE_DAYS) continue;

      let vaccineTitle: string;
      if (daysUntilVaccine < 0) {
        vaccineTitle = `‼️ เลยกำหนดให้${vaccineName}ที่${coopName}มา ${-daysUntilVaccine} วันแล้ว`;
      } else if (daysUntilVaccine === 0) {
        vaccineTitle = `‼️ วันนี้ถึงกำหนดให้${vaccineName}ที่${coopName}`;
      } else if (daysUntilVaccine === 1) {
        vaccineTitle = `💉 พรุ่งนี้ถึงกำหนดให้${vaccineName}ที่${coopName}`;
      } else {
        vaccineTitle = `💉 อีก ${daysUntilVaccine} วันถึงกำหนดให้${vaccineName}ที่${coopName}`;
      }

      notifications.push({
        id: `vaccine_${a?.id}`,
        type: 'vaccine',
        title: vaccineTitle,
        urgent: daysUntilVaccine <= 0,
        daysUntil: daysUntilVaccine,
        coopId,
        coopName,
        method: a?.injection_type || '-',
        chickenAge: a?.chicken_age || 0,
        description: a?.description || '',
      });
    }

    // 5. แจ้งเตือนตรวจจับความเคลื่อนไหว (เซนเซอร์ PIR ที่วงกบประตู) - รวมเป็น 1
    // แจ้งเตือนต่อคอก (ไม่ใช่ 1 อันต่อครั้งตรวจจับ เพราะอาจมีหลายสิบครั้ง/วัน) โชว์
    // จำนวนครั้งรวมกับเวลาที่ตรวจจับล่าสุด ข้อมูลดิบมาจาก /api/motion-alerts
    // (เรียงล่าสุดมาก่อนอยู่แล้วจาก backend)
    const motionAcks = loadMotionAcks();
    const motionByCoop = new Map<string, { coopName: string; count: number; lastAt: Date }>();
    for (const m of motion) {
      const coopId = m?.coop_id != null ? String(m.coop_id) : null;
      const ts = m?.timestamp ? new Date(m.timestamp) : null;
      if (!coopId || !ts || isNaN(ts.getTime())) continue;
      if (ts.getTime() <= (motionAcks[coopId] || 0)) continue;
      const coopName = m?.coop_name || coopNames.get(coopId) || `คอก ${coopId}`;
      const existing = motionByCoop.get(coopId);
      if (existing) {
        existing.count += 1;
        if (ts > existing.lastAt) existing.lastAt = ts;
      } else {
        motionByCoop.set(coopId, { coopName, count: 1, lastAt: ts });
      }
    }
    for (const [coopId, info] of motionByCoop) {
      const timeLabel = info.lastAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      notifications.push({
        id: `motion_${coopId}`,
        type: 'motion',
        title: `🚶 ตรวจพบความเคลื่อนไหวที่${info.coopName} (${info.count} ครั้ง ล่าสุด ${timeLabel})`,
        urgent: false,
        daysUntil: -1,
        coopId,
        coopName: info.coopName,
        motionLastAt: info.lastAt.getTime(),
      });
    }

    notifications.sort((a, b) => a.daysUntil - b.daysUntil);
    return notifications;
  }
}
