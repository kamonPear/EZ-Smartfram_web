import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { Device } from '../../shared/coop-summary.util';

interface SlotData {
  id: number;
  device: { name: string; icon: string } | null;
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

  coopId: string | null = null;
  coopName: string | null = null;
  isLoading = true;
  devices: Device[] = [];
  slots: SlotData[] = [];

  trackStatuses = [
    { id: 'top', name: 'รางบน' },
    { id: 'middle', name: 'รางกลาง' },
    { id: 'bottom', name: 'รางล่าง' }
  ];
  selectedTrack = this.trackStatuses[0];

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
    this.refreshSubscription = interval(5000).subscribe(() => this.fetchDevices(true));
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
        this.slots[index].device = { name: device.name, icon: device.icon };
        this.slots[index].status = device.current_status === 'Online' ? 'normal' : 'offline';
      }
    });
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

  onTrackChange(event: any) {
    const trackId = event.target.value;
    this.selectedTrack = this.trackStatuses.find(t => t.id === trackId) || this.trackStatuses[0];
  }

  getSensorsForSelectedTrack(): Device[] {
    let startIndex = 0;
    let endIndex = 7;

    if (this.selectedTrack.id === 'middle') {
      startIndex = 7; endIndex = 14;
    } else if (this.selectedTrack.id === 'bottom') {
      startIndex = 14; endIndex = 21;
    }

    return this.devices
      .filter(d => d.slot_index !== undefined && d.slot_index !== null && d.slot_index >= startIndex && d.slot_index < endIndex)
      .sort((a, b) => (a.slot_index ?? 0) - (b.slot_index ?? 0));
  }
}
