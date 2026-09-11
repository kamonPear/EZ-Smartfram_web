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
}

export interface EggRecord {
  egg_id: number;
  coop_id?: number;
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
  pos_x?: number | null;
  pos_y?: number | null;
  devices?: Device[];
  eggs?: EggRecord[];
  health?: HealthRecord[];
  vaccines?: VaccineRecord[];
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
  return latestBy(coop.vaccines, 'record_date');
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
