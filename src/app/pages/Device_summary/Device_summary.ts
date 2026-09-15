import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { Device, Coop } from '../../shared/coop-summary.util';
import { deviceIconSrc } from '../../shared/device-icon.util';

interface DeviceGroup {
  name: string;
  icon: string;
  total: number;
  online: number;
  devices: (Device & { name_coop: string })[];
}

// สรุปอุปกรณ์/เซนเซอร์รวมทั้งฟาร์ม - นับจำนวนอุปกรณ์แต่ละชนิดรวมทุกคอกเป็นยอด
// เดียว ไม่แยกโชว์ทีละคอกเหมือนหน้า "ระบบเซนเซอร์" (Chicken_sensor_System) เดิม
// ที่ต้องเลือกคอกก่อนถึงจะเห็นอุปกรณ์ - ตรงกับที่แอปมือถือทำไว้ (MainDeviceSummary)
@Component({
  selector: 'app-device-summary',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './Device_summary.html',
  styleUrls: ['./Device_summary.scss']
})
export class DeviceSummaryComponent {
  isLoading = true;
  groups: DeviceGroup[] = [];
  totalDevices = 0;
  totalOnline = 0;

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

        const byName = new Map<string, DeviceGroup>();
        for (const d of devices || []) {
          const name = (d.name || '').trim();
          if (!name) continue;
          const isOnline = (d.current_status || '').toLowerCase() === 'online';

          let group = byName.get(name);
          if (!group) {
            group = { name, icon: deviceIconSrc(d), total: 0, online: 0, devices: [] };
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

  toggleGroup(group: DeviceGroup) {
    this.expandedGroupName = this.expandedGroupName === group.name ? null : group.name;
  }

  isOnline(d: Device): boolean {
    return (d.current_status || '').toLowerCase() === 'online';
  }
}
