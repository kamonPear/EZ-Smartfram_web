import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { Device, Coop } from '../../shared/coop-summary.util';
import { deviceIconSrc } from '../../shared/device-icon.util';
import { SiteSearchComponent } from '../../components/site-search/site-search.component';

interface DeviceGroup {
  name: string;
  icon: string;
  total: number;
  online: number;
  // พัดลม/หลอดไฟ (Actuator): "ออนไลน์" ของมันแปลว่ากำลังเปิดอยู่ จึงแสดงเป็น เปิด/ปิด แทน
  actuator: boolean;
  devices: (Device & { name_coop: string })[];
}

// บอร์ด ESP32 ของแต่ละคอก - ระบบไม่มีตารางบอร์ดแยก (บอร์ด 1 ตัวดูแล 1 คอก และส่งค่าของทุก
// อุปกรณ์ในคอกนั้นมาพร้อมกันทาง MQTT) จึงคิดสถานะบอร์ดจากอุปกรณ์ในคอก: ถ้ามีอุปกรณ์ชื่อ ESP32
// วางไว้ ใช้สถานะของตัวนั้น ไม่งั้นถือว่าบอร์ดทำงาน ถ้าอุปกรณ์ตัวไหนในคอกยังออนไลน์ หรือเพิ่งส่ง
// ข้อมูลมาไม่เกิน BOARD_ALIVE_MS (พัดลม/หลอดไฟที่ปิดอยู่ก็ยังส่งข้อมูลมา แปลว่าบอร์ดยังทำงาน)
interface BoardRow {
  coopId: number;
  coopName: string;
  online: boolean;
  lastUpdate: Date | null;
  deviceCount: number;
}
const BOARD_ALIVE_MS = 60_000;

// สรุปอุปกรณ์/เซนเซอร์รวมทั้งฟาร์ม - นับจำนวนอุปกรณ์แต่ละชนิดรวมทุกคอกเป็นยอด
// เดียว ไม่แยกโชว์ทีละคอกเหมือนหน้า "ระบบเซนเซอร์" (Chicken_sensor_System) เดิม
// ที่ต้องเลือกคอกก่อนถึงจะเห็นอุปกรณ์ - ตรงกับที่แอปมือถือทำไว้ (MainDeviceSummary)
@Component({
  selector: 'app-device-summary',
  standalone: true,
  imports: [CommonModule, RouterModule, SiteSearchComponent],
  templateUrl: './Device_summary.html',
  styleUrls: ['./Device_summary.scss']
})
export class DeviceSummaryComponent {
  isLoading = true;
  groups: DeviceGroup[] = [];
  totalDevices = 0;
  totalOnline = 0;
  boards: BoardRow[] = [];
  boardsOnline = 0;

  // ชนิดอุปกรณ์ที่กำลังกางดูรายละเอียดอยู่ (ชื่อ) - แค่ชื่อเดียวเปิดได้ทีละอัน
  // แทนการเปิดหน้าใหม่ ตามที่ผู้ใช้ขอให้เด้งลงมาข้างล่างชื่อที่กดแทน
  expandedGroupName: string | null = null;

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {
    this.fetchDevices();
  }

  fetchDevices() {
    this.isLoading = true;
    forkJoin({
      devices: this.api.get<Device[]>('/devices'),
      coops: this.api.get<Coop[]>('/coops'),
    }).subscribe({
      next: ({ devices, coops }) => {
        // ✅ ห้ามพึ่ง name_coop ที่ติดมากับตัว device เอง (backend ส่งเป็นค่าว่าง
        // เสมอ) ต้องดึงชื่อจริงจาก /coops มาจับคู่กับ coop_id เอง
        const coopNames = new Map<number, string>();
        for (const c of coops || []) {
          coopNames.set(c.coop_id, c.name_coop || `คอก ${c.coop_id}`);
        }

        this.boards = this.buildBoards(devices || [], coopNames);
        this.boardsOnline = this.boards.filter((b) => b.online).length;

        const byName = new Map<string, DeviceGroup>();
        for (const d of devices || []) {
          const name = (d.name || '').trim();
          if (!name || this.isBoardDevice(d)) continue;
          const isOnline = (d.current_status || '').toLowerCase() === 'online';

          let group = byName.get(name);
          if (!group) {
            group = { name, icon: deviceIconSrc(d), total: 0, online: 0, actuator: this.isActuator(d), devices: [] };
            byName.set(name, group);
          }
          group.total += 1;
          if (isOnline) group.online += 1;
          group.devices.push({
            ...d,
            name_coop: coopNames.get(d.coop_id ?? -1) || `คอก ${d.coop_id ?? '-'}`,
          });
        }

        // เรียงให้คอกที่ออนไลน์อยู่ก่อน แล้วค่อยตามด้วยชื่อคอก ดูง่ายว่าตัวไหนน่ากังวล
        for (const g of byName.values()) {
          g.devices.sort((a, b) => {
            const aOnline = (a.current_status || '').toLowerCase() === 'online';
            const bOnline = (b.current_status || '').toLowerCase() === 'online';
            if (aOnline !== bOnline) return aOnline ? -1 : 1;
            return a.name_coop.localeCompare(b.name_coop);
          });
        }

        this.groups = Array.from(byName.values()).sort((a, b) => b.total - a.total);
        this.totalDevices = this.groups.reduce((s, g) => s + g.total, 0);
        this.totalOnline = this.groups.reduce((s, g) => s + g.online, 0);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('โหลดข้อมูลอุปกรณ์ไม่สำเร็จ:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // อุปกรณ์ที่เป็นตัวบอร์ดเอง (เช่นวาง "ESP 32" ไว้ในผังคอก) ไม่นับเป็นเซนเซอร์
  isBoardDevice(d: Device): boolean {
    return /esps*-?s*32/i.test(d.name || '');
  }

  isActuator(d: Device): boolean {
    return (d.device_type || '').toLowerCase() === 'actuator';
  }

  private buildBoards(devices: Device[], coopNames: Map<number, string>): BoardRow[] {
    const byCoop = new Map<number, Device[]>();
    for (const d of devices) {
      if (d.coop_id == null) continue;
      if (!byCoop.has(d.coop_id)) byCoop.set(d.coop_id, []);
      byCoop.get(d.coop_id)!.push(d);
    }
    const now = Date.now();
    const rows: BoardRow[] = [];
    for (const [coopId, list] of byCoop) {
      const times = list.map((d) => (d.last_update ? new Date(d.last_update).getTime() : NaN)).filter((t) => !isNaN(t) && t > 0);
      const last = times.length ? Math.max(...times) : null;
      const esp = list.find((d) => this.isBoardDevice(d));
      const online = esp ? this.isOnline(esp) : list.some((d) => this.isOnline(d)) || (last != null && now - last <= BOARD_ALIVE_MS);
      rows.push({ coopId, coopName: coopNames.get(coopId) || `คอก ${coopId}`, online, lastUpdate: last ? new Date(last) : null, deviceCount: list.filter((d) => !this.isBoardDevice(d)).length });
    }
    return rows.sort((a, b) => (a.online === b.online ? a.coopName.localeCompare(b.coopName) : a.online ? -1 : 1));
  }

  lastSeen(b: BoardRow): string {
    if (!b.lastUpdate) return 'ยังไม่เคยส่งข้อมูล';
    return 'ส่งข้อมูลล่าสุด ' + b.lastUpdate.toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  statusText(d: Device, actuator: boolean): string {
    if (actuator) return this.isOnline(d) ? 'เปิดอยู่' : 'ปิดอยู่';
    return this.isOnline(d) ? 'ทำงานอยู่' : 'ออฟไลน์';
  }

  toggleGroup(group: DeviceGroup) {
    this.expandedGroupName = this.expandedGroupName === group.name ? null : group.name;
  }

  isOnline(d: Device): boolean {
    return (d.current_status || '').toLowerCase() === 'online';
  }
}
