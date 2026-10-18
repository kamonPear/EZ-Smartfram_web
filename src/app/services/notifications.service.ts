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

// แจ้งเตือน "ไก่เปลี่ยนช่วงอายุ ต้องเปลี่ยนประเภทอาหาร" ที่ผู้ใช้กด "รับทราบ" แล้ว (id ผูกกับ
// คอก+ประเภทอาหารใหม่ จึงไม่ขึ้นซ้ำ แต่ถ้าเปลี่ยนช่วงถัดไปจะขึ้นเป็นแจ้งเตือนใหม่)
const FOOD_SWITCH_ACK_KEY = 'ez_food_switch_ack';

function loadFoodSwitchAcks(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(FOOD_SWITCH_ACK_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}


// เตือนล่วงหน้า/ค้างหลังเปลี่ยนช่วงอายุกี่วัน (ก่อนและหลังวันที่ไก่ถึงอายุขั้นต่ำของช่วงใหม่)
const FOOD_SWITCH_WINDOW_DAYS = 3;

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
    // แหล่งข้อมูลที่โหลดไม่สำเร็จในรอบนี้ - ไม่ทำให้ทั้งรายการล้ม (แหล่งที่เหลือยังโชว์
    // ได้) แต่ผู้เรียกเช็ค lastLoadFailed ได้ ไม่ให้ "โหลดไม่ได้" ถูกตีความเป็น
    // "ไม่มีแจ้งเตือน"
    const failed: string[] = [];
    const safe = (name: string, path: string) =>
      this.api.get<any[]>(path).pipe(
        catchError((err) => {
          console.error(`โหลด ${path} สำหรับแจ้งเตือนไม่สำเร็จ:`, err);
          failed.push(name);
          return of([] as any[]);
        })
      );
    return forkJoin({
      foods: safe('อาหาร', '/foods'),
      coops: safe('คอก', '/coops'),
      alerts: safe('วัคซีน', '/vaccines/alerts'),
      healths: safe('สุขภาพ', '/healths'),
      motion: safe('ความเคลื่อนไหว', '/motion-alerts'),
      appointments: safe('นัดตรวจสุขภาพ', '/health-appointments'),
      foodRules: safe('ตารางอาหารตามอายุ', '/food-age-rules'),
    }).pipe(
      map(({ foods, coops, alerts, healths, motion, appointments, foodRules }) => {
        this.lastLoadFailed = failed;
        return this.build(foods || [], coops || [], alerts || [], healths || [], motion || [], appointments || [], foodRules || []);
      })
    );
  }

  /** ชื่อแหล่งข้อมูลที่โหลดไม่สำเร็จในการ load() ครั้งล่าสุด (ว่าง = สำเร็จทั้งหมด) */
  lastLoadFailed: string[] = [];

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

  /** บันทึกว่ารับทราบแจ้งเตือนเปลี่ยนประเภทอาหารตามอายุนี้แล้ว */
  acknowledgeFoodSwitch(id: string) {
    try {
      const acks = loadFoodSwitchAcks();
      if (!acks.includes(id)) acks.push(id);
      localStorage.setItem(FOOD_SWITCH_ACK_KEY, JSON.stringify(acks));
    } catch {
      // เขียน localStorage ไม่ได้ - ยอมให้แจ้งเตือนกลับมาตอนโหลดใหม่
    }
  }

  private build(foods: any[], coops: any[], alerts: any[], healths: any[], motion: any[] = [], appointments: any[] = [], foodRules: any[] = []): FarmNotification[] {
    const notifications: FarmNotification[] = [];
    const today = new Date();
    const todayOnly = dateOnly(today);

    // 1. แจ้งเตือนปริมาณอาหาร (ใกล้หมด / หมดแล้ว)
    for (const row of foods) {
      // ไม่มีค่าปริมาณคงเหลือมาเลย (null) = ไม่รู้ ไม่ใช่ 0 - ข้ามไป ไม่เตือนว่าหมดผิดๆ
      if (row?.quantity_current == null) continue;
      const current = Number(row.quantity_current);
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
      } else if (min > 0 && current <= min) {
        notifications.push({
          id: `food_${foodId}`,
          type: 'food',
          title: `⚠️ อาหาร${foodType}ใกล้หมดแล้ว (เหลือ ${current.toFixed(1)} กก.)`,
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

    // แจ้งเตือนตรวจสุขภาพ 1 รายการ - ใช้ร่วมกันทั้งนัดที่คำนวณจากวัคซีนและนัดที่ตั้งเอง
    // id ผูกกับคอก+วันนัด จึงกันซ้ำเองถ้าสองแหล่งชี้วันเดียวกัน (vaccineName ว่าง =
    // นัดที่ตั้งเอง ไม่ผูกกับวัคซีนตัวไหน)
    const seenHealthIds = new Set<string>();
    const pushHealthNotification = (coopId: string, coopName: string, checkDate: Date, vaccineName: string | null) => {
      const daysUntilHealthCheck = Math.round((checkDate.getTime() - todayOnly.getTime()) / 86400000);
      if (daysUntilHealthCheck > ADVANCE_DAYS) return;
      if (checkedHealthDates.has(`${coopId}_${dateKey(checkDate)}`)) return;
      const id = `health_${coopId}_${dateKey(checkDate)}`;
      if (seenHealthIds.has(id)) return;
      seenHealthIds.add(id);

      const forWhat = vaccineName ? `ก่อนให้${vaccineName}` : '';
      let title: string;
      if (daysUntilHealthCheck < 0) {
        title = vaccineName
          ? `‼️ เลยกำหนดตรวจสุขภาพที่${coopName}${forWhat}มา ${-daysUntilHealthCheck} วันแล้ว`
          : `‼️ เลยกำหนดตรวจสุขภาพที่${coopName}มา ${-daysUntilHealthCheck} วันแล้ว`;
      } else if (daysUntilHealthCheck === 0) {
        title = `‼️ วันนี้ถึงกำหนดตรวจสุขภาพที่${coopName}${forWhat}`;
      } else if (daysUntilHealthCheck === 1) {
        title = `🩺 พรุ่งนี้ถึงกำหนดตรวจสุขภาพที่${coopName}${forWhat}`;
      } else {
        title = `🩺 อีก ${daysUntilHealthCheck} วันถึงกำหนดตรวจสุขภาพที่${coopName}${forWhat}`;
      }

      notifications.push({
        id,
        type: 'health',
        title,
        urgent: daysUntilHealthCheck <= 0,
        daysUntil: daysUntilHealthCheck,
        coopId,
        coopName,
      });
    };

    // 3a. นัดตรวจสุขภาพที่ผู้ใช้ตั้งเอง (หน้า "นัดตรวจสุขภาพ" โหมดกำหนดเอง)
    for (const m of appointments) {
      const coopId = m?.coop_id != null ? String(m.coop_id) : null;
      const d = m?.appointment_date ? new Date(m.appointment_date) : null;
      if (!coopId || !d || isNaN(d.getTime())) continue;
      pushHealthNotification(coopId, coopNames.get(coopId) || `คอก ${coopId}`, dateOnly(d), null);
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
      pushHealthNotification(coopId, coopName, healthCheckDate, vaccineName);

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

    // 6. แจ้งเตือนไก่เปลี่ยนช่วงอายุ -> ต้องเปลี่ยนประเภทอาหาร (ตามตารางอาหารตามอายุที่เจ้าของ
    // ตั้งไว้) หาขอบช่วงที่ประเภทอาหารต่างจากช่วงก่อนหน้า แล้วเตือนล่วงหน้า/ค้างหลังถึงวันนั้น
    // FOOD_SWITCH_WINDOW_DAYS วัน (วันถึงขอบช่วง = วันเกิด + min_weeks x 7 วัน)
    const rules = foodRules
      .map(r => ({ type: String(r?.food_type ?? ''), min: Number(r?.min_weeks ?? 0), max: Number(r?.max_weeks ?? 0) }))
      .filter(r => r.type);
    const ruleAt = (ageWeeks: number) =>
      rules.find(r => ageWeeks >= r.min && (r.max === 0 || ageWeeks < r.max));
    const foodSwitchAcks = new Set(loadFoodSwitchAcks());
    for (const c of coops) {
      const birthday = c?.birthday ? new Date(c.birthday) : null;
      if (!birthday || isNaN(birthday.getTime())) continue;
      const coopId = String(c?.coop_id ?? c?.id ?? '');
      const coopName = coopNames.get(coopId) || `คอก ${coopId}`;
      const birthOnly = dateOnly(birthday);

      let best: { days: number; from: string; to: string } | null = null;
      for (const r of rules) {
        if (r.min <= 0) continue;
        const prev = ruleAt(r.min - 1);
        if (!prev || prev.type === r.type) continue;
        const boundary = new Date(birthOnly);
        boundary.setDate(boundary.getDate() + r.min * 7);
        const days = Math.round((boundary.getTime() - todayOnly.getTime()) / 86400000);
        if (days > FOOD_SWITCH_WINDOW_DAYS || days < -FOOD_SWITCH_WINDOW_DAYS) continue;
        if (!best || Math.abs(days) < Math.abs(best.days)) best = { days, from: prev.type, to: r.type };
      }
      if (!best) continue;

      const id = `foodswitch_${coopId}_${best.to}`;
      if (foodSwitchAcks.has(id)) continue;

      let title: string;
      if (best.days < 0) {
        title = `🌾 ${coopName}ถึงช่วงเปลี่ยนเป็นอาหาร${best.to}มา ${-best.days} วันแล้ว (จากเดิมอาหาร${best.from}) กรุณาเปลี่ยนอาหาร`;
      } else if (best.days === 0) {
        title = `🌾 วันนี้${coopName}ต้องเปลี่ยนจากอาหาร${best.from}เป็นอาหาร${best.to}`;
      } else if (best.days === 1) {
        title = `🌾 พรุ่งนี้${coopName}ต้องเปลี่ยนจากอาหาร${best.from}เป็นอาหาร${best.to}`;
      } else {
        title = `🌾 อีก ${best.days} วัน${coopName}ต้องเปลี่ยนจากอาหาร${best.from}เป็นอาหาร${best.to}`;
      }
      notifications.push({
        id,
        type: 'food',
        title,
        urgent: best.days <= 0,
        daysUntil: best.days,
        coopId,
        coopName,
      });
    }

    notifications.sort((a, b) => a.daysUntil - b.daysUntil);
    return notifications;
  }
}
