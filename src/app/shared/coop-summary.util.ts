// ชนิดข้อมูลและฟังก์ชันช่วยสรุปข้อมูลคอกไก่ ใช้ร่วมกันทั้งหน้ารายการคอก (Home_pages1)
// และหน้าจัดวางผังฟาร์ม (Farm_layout) เพื่อไม่ให้ตรรกะ "หาข้อมูลล่าสุด" ซ้ำกันสองที่

export interface Device {
  device_id: number;
  coop_id?: number;
  name: string;
  icon: string;
  device_type?: string;
  slot_index?: number;
  current_status: string;
  last_update?: string;
  value?: number | null;
}

export interface EggRecord {
  egg_id: number;
  coop_id?: number;
  name_coop?: string;
  date_collect_egg: string;
  number_egg: number;
  note?: string;
}

export interface HealthRecord {
  health_id: number;
  coop_id?: number;
  healthy: number;
  poor_health: number;
  record_date: string;
  note?: string;
}

export interface VaccineRecord {
  vaccine_id: number;
  coop_id?: number;
  name: string;
  method?: string;
  recommended_age?: string;
  birthday?: string | null;
  record_date: string;
  note?: string;
}

export interface Coop {
  coop_id: number;
  name_coop: string;
  amount: number;
  birthday?: string | null;
  pos_x?: number | null;
  pos_y?: number | null;
  devices?: Device[];
  eggs?: EggRecord[];
  health?: HealthRecord[];
  // ตั้งแต่แยกตาราง vaccine ออกเป็น vaccine (ประเภท) + vaccine_history (ประวัติให้
  // จริงต่อคอก) แล้ว backend ส่งกลับมาในฟิลด์นี้แทน "vaccines" เดิม
  vaccine_history?: VaccineRecord[];
}

function latestBy<T>(records: T[] | undefined, dateField: keyof T): T | null {
  if (!records || records.length === 0) return null;
  return [...records].sort(
    (a, b) => new Date(b[dateField] as any).getTime() - new Date(a[dateField] as any).getTime()
  )[0];
}

export function latestHealth(coop: Coop): HealthRecord | null {
  return latestBy(coop.health, 'record_date');
}

export function latestEgg(coop: Coop): EggRecord | null {
  return latestBy(coop.eggs, 'date_collect_egg');
}

export function latestVaccine(coop: Coop): VaccineRecord | null {
  return latestBy(coop.vaccine_history, 'record_date');
}

/** จำนวนวัคซีน "ชนิด" ที่เคยให้คอกนี้ไปแล้ว (นับชื่อไม่ซ้ำ ไม่ใช่จำนวนครั้ง) */
export function vaccineTypeCount(coop: Coop): number {
  const names = new Set((coop.vaccine_history || []).map((v) => v.name));
  return names.size;
}

/** รวมจำนวนไข่ทั้งหมดที่เก็บได้ของคอกนี้ (ผลรวมทุกรอบเก็บ ไม่ใช่แค่ครั้งล่าสุด) */
export function totalEggCount(coop: Coop): number {
  return (coop.eggs || []).reduce((sum, e) => sum + (e.number_egg || 0), 0);
}

/** true = อุปกรณ์สั่งเปิด/ปิด (พัดลม/หลอดไฟ) ไม่ใช่เซนเซอร์วัดค่า - ตัดสินจากชื่อ
 *  อุปกรณ์เหมือนกับ deviceIconSrc เพราะ backend ไม่ได้ส่ง device_type มาให้ใช้แยกจริงจัง */
export function isActuatorDevice(name: string | undefined | null): boolean {
  const n = (name || '').toLowerCase();
  return n.includes('พัดลม') || n.includes('fan') ||
         n.includes('หลอดไฟ') || n.includes('ไฟ') || n.includes('bulb') || n.includes('light');
}

export function deviceSummary(coop: Coop): { online: number; total: number } {
  const total = coop.devices?.length ?? 0;
  const online = coop.devices?.filter((d) => d.current_status === 'Online').length ?? 0;
  return { online, total };
}

/** วันที่แบบไทย (พ.ศ.) สั้นๆ เช่น "3 ก.พ. 2569" ใช้ในการ์ดสรุปข้อมูลคอก */
export function formatThaiDate(isoDate: string | undefined | null): string {
  if (!isoDate) return '-';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}
