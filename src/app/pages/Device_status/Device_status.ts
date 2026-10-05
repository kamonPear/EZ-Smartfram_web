import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { Device, isActuatorDevice } from '../../shared/coop-summary.util';
import { deviceIconSrc } from '../../shared/device-icon.util';

interface SlotData {
  id: number;
  device: { name: string; icon: string; label: string } | null;
  status: 'normal' | 'offline';
  showStatus?: boolean;
  x: number; // ตำแหน่งแนวนอน (%) บนแคนวาส คำนวณจากช่อง 7x3 ให้ตรงกับหน้าจัดวางระบบ
  y: number; // ตำแหน่งแนวตั้ง (%) บนแคนวาส
}

@Component({
  selector: 'app-device-status',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './Device_status.html',
  styleUrls: ['./Device_status.scss']
})
export class DeviceStatusComponent implements OnInit, OnDestroy {

  deviceIconSrc = deviceIconSrc;

  coopId: string | null = null;
  coopName: string | null = null;
  isLoading = true;
  devices: Device[] = [];
  slots: SlotData[] = [];
  private labels = new Map<Device, string>();

  private refreshSubscription!: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.coopId = this.route.snapshot.queryParamMap.get('coop');
    if (!this.coopId) {
      alert('ไม่พบคอกที่ต้องการดูสถานะอุปกรณ์');
      this.router.navigate(['/home']);
      return;
    }
    this.fetchDevices();
    this.refreshSubscription = interval(2000).subscribe(() => this.fetchDevices(true));
  }

  ngOnDestroy(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  fetchDevices(silent = false) {
    if (!this.coopId) return;
    if (!silent) this.isLoading = true;

    this.api.get<any>(`/coops?id=${this.coopId}`).subscribe({
      next: (data) => {
        this.coopName = data?.name_coop || null;
        this.devices = data?.devices || [];
        this.buildSlots();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('ดึงข้อมูลอุปกรณ์ล้มเหลว:', err);
        if (!silent) alert('ไม่พบข้อมูลคอกนี้');
      }
    });
  }

  private buildSlots() {
    this.labels = this.buildLabels();
    this.slots = Array.from({ length: 21 }, (_, i) => {
      const row = Math.floor(i / 7);
      const col = i % 7;
      return {
        id: i,
        device: null,
        status: 'offline' as const,
        showStatus: false,
        x: ((col + 0.5) / 7) * 100,
        y: ((row + 0.5) / 3) * 100
      };
    });

    this.devices.forEach(device => {
      const index = device.slot_index;
      if (index !== undefined && index !== null && index >= 0 && index < 21) {
        this.slots[index].device = { name: device.name, icon: device.icon, label: this.labels.get(device) ?? device.name };
        this.slots[index].status = device.current_status === 'Online' ? 'normal' : 'offline';
      }
    });
  }

  // ถ้าคอกมีอุปกรณ์ชื่อเดียวกันหลายตัว ให้ต่อท้ายด้วยลำดับ (#1, #2, ...) ตามลำดับ
  // ช่องที่วาง ถ้ามีตัวเดียวก็ไม่ต้องใส่เลข
  private buildLabels(): Map<Device, string> {
    const sorted = this.sortedDevices;
    const totals = new Map<string, number>();
    sorted.forEach(d => totals.set(d.name, (totals.get(d.name) ?? 0) + 1));

    const seen = new Map<string, number>();
    const labels = new Map<Device, string>();
    sorted.forEach(d => {
      const n = (seen.get(d.name) ?? 0) + 1;
      seen.set(d.name, n);
      labels.set(d, (totals.get(d.name) ?? 0) > 1 ? `${d.name} #${n}` : d.name);
    });
    return labels;
  }

  deviceLabel(device: Device): string {
    return this.labels.get(device) ?? device.name;
  }

  get placedSlots() {
    return this.slots.filter(s => s.device);
  }

  setTooltipVisible(slot: SlotData, visible: boolean) {
    if (slot.device) {
      slot.showStatus = visible;
    }
  }

  getStatusLabel(status: string): string {
    return status === 'normal' ? 'ออนไลน์ (กำลังทำงาน)' : 'ออฟไลน์ (ไม่ได้ทำงาน)';
  }

  // เดิมแยกตาม "ราง" (บน/กลาง/ล่าง) ให้เลือกกรองดู - ตัดคอนเซปตำแหน่งแบบตายตัว
  // นี้ออกแล้ว (วางอุปกรณ์ได้อิสระ ไม่ผูกกับรางไหน) เปลี่ยนเป็นโชว์รายการ
  // อุปกรณ์ทั้งหมดของคอกนี้เรียงตามลำดับที่วางไว้แทน
  get sortedDevices(): Device[] {
    return [...this.devices].sort((a, b) => (a.slot_index ?? 0) - (b.slot_index ?? 0));
  }

  get onlineCount(): number {
    return this.devices.filter(d => d.current_status === 'Online').length;
  }

  // พัดลม/หลอดไฟ ไม่ใช่เซนเซอร์วัดค่า ให้โชว์เป็น "ทำงาน/ไม่ทำงาน" แทน
  // "ออนไลน์/ออฟไลน์" จะได้เข้าใจง่ายกว่า (ค่า current_status มาจาก MQTT ที่ตัวบอร์ด
  // ส่งขึ้นมาเฉพาะตอนรีเลย์เปิดอยู่เท่านั้น ดู sketch_coop54.ino)
  isActuator(device: Device): boolean {
    return isActuatorDevice(device.name);
  }

  statusLabel(device: Device): string {
    const online = device.current_status === 'Online';
    if (this.isActuator(device)) {
      return online ? 'ทำงาน' : 'ไม่ทำงาน';
    }
    return online ? 'ออนไลน์' : 'ออฟไลน์';
  }

  // PIR ส่งมาเป็น 0/1 ให้แปลงเป็นข้อความแทนตัวเลขดิบ
  valueText(device: Device): string {
    if ((device.name || '').toLowerCase().includes('pir')) {
      return Number(device.value) ? 'ตรวจพบ' : 'ไม่พบ';
    }
    return Number(device.value).toLocaleString('en-US', { maximumFractionDigits: 1 });
  }

  // เดาหน่วยจากชื่ออุปกรณ์ เพื่อโชว์ค่าเซนเซอร์ให้อ่านง่ายขึ้น (backend ส่งมาแค่ตัวเลข
  // ดิบๆ ไม่มีหน่วยกำกับมาด้วย)
  unitFor(device: Device): string {
    const n = (device.name || '').toLowerCase();
    if (n.includes('อุณหภูมิ') || n.includes('temp')) return '°C';
    if (n.includes('ความชื้น') || n.includes('humid')) return '%';
    return '';
  }
}
