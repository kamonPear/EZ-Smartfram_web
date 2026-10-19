import { Injectable, signal } from '@angular/core';

// ป็อบอัพ "ยืนยันก่อนบันทึก" ตัวกลางของทั้งเว็บ - ทุกหน้าที่มีปุ่มบันทึกเรียก ask() ก่อนส่งข้อมูล
// ไป backend เพื่อให้เจ้าของฟาร์มทวนข้อมูลอีกรอบ ตัวป็อบอัพวางไว้ครั้งเดียวใน app.html
// (ConfirmDialogComponent) หน้าไหนก็เรียกใช้ได้โดยไม่ต้องเขียน modal ซ้ำ
//
// ใช้ signal เก็บสถานะ เพราะเว็บนี้ไม่มี zone.js - signal สั่งให้หน้าจอวาดใหม่เองเมื่อค่าเปลี่ยน
//
// วิธีใช้:  if (!(await this.confirm.ask({ message: 'บันทึกคอก A ใช่ไหม?' }))) return;
export interface ConfirmOptions {
  title?: string;
  message: string;
  // รายละเอียดที่จะบันทึก แสดงเป็นรายการให้ทวน (เช่น ['ชื่อคอก: A', 'จำนวนไก่: 40 ตัว'])
  details?: string[];
  confirmText?: string;
  cancelText?: string;
}

// วันที่แบบไทยสั้น ๆ ไว้แสดงในรายละเอียดของป็อบอัพ เช่น 19 ต.ค. 2569
export function thDate(d: Date | string | null | undefined): string {
  if (!d) return '-';
  const date = new Date(d);
  return isNaN(date.getTime()) ? '-' : date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

// สร้างรายการ "สิ่งที่แก้ไข" สำหรับหน้าแก้ไขข้อมูล - เอาเฉพาะช่องที่ค่าเปลี่ยนจริง
// แต่ละแถว: [ชื่อช่อง, ค่าเดิม, ค่าใหม่] ได้ผลเช่น "จำนวนไก่: 50 ตัว → 55 ตัว"
// คืน [] ถ้าไม่มีอะไรเปลี่ยน (หน้าที่เรียกใช้ควรแจ้งว่า "ยังไม่ได้แก้ไขข้อมูล" แทนการบันทึก)
export function changedLines(rows: [string, unknown, unknown][]): string[] {
  const show = (v: unknown) => (v === null || v === undefined || String(v).trim() === '' ? '(ว่าง)' : String(v).trim());
  return rows.filter(([, a, b]) => show(a) !== show(b)).map(([label, a, b]) => `${label}: ${show(a)} → ${show(b)}`);
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly current = signal<ConfirmOptions | null>(null);
  private resolver: ((ok: boolean) => void) | null = null;

  ask(options: ConfirmOptions): Promise<boolean> {
    // ถ้ามีป็อบอัพค้างอยู่ (กดซ้ำเร็ว ๆ) ถือว่าอันเดิมถูกยกเลิก
    this.resolver?.(false);
    this.current.set({ title: 'ยืนยันการบันทึก', confirmText: 'ยืนยัน บันทึก', cancelText: 'กลับไปแก้ไข', ...options });
    return new Promise<boolean>((resolve) => (this.resolver = resolve));
  }

  answer(ok: boolean) {
    const resolve = this.resolver;
    this.resolver = null;
    this.current.set(null);
    resolve?.(ok);
  }
}
