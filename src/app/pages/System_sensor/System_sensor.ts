import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Subscription, interval } from 'rxjs'; 

interface SlotData {
  id: number;
  device: { name: string; icon: string } | null;
  status: 'normal' | 'offline' | 'empty';
  showStatus?: boolean; 
}

@Component({
  selector: 'app-system-sensor',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './System_sensor.html',
  styleUrls: ['./System_sensor.scss']
})
export class SystemSensorComponent implements OnInit, OnDestroy { 

  slots: SlotData[] = [];
  selectedCoop: string | null = null; 
  isLoading: boolean = false; 

  trackStatuses = [
    { id: 'top', name: 'รางบน', status: 'normal', statusText: 'ออนไลน์' },
    { id: 'middle', name: 'รางกลาง', status: 'normal', statusText: 'ออนไลน์' }, 
    { id: 'bottom', name: 'รางล่าง', status: 'offline', statusText: 'ออฟไลน์' } 
  ];

  selectedTrackStatus: any = null;
  private refreshSubscription!: Subscription; 

  constructor(
    private route: ActivatedRoute, 
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const state = history.state;
    if (state && state.coopNumber) {
      this.selectedCoop = state.coopNumber; 
    }

    this.route.queryParams.subscribe(params => {
      console.log('URL Params:', params);
      
      if (params['coop']) {
        this.selectedCoop = params['coop'];
      }
      
      this.initializeEmptySlots();

      if (state && state.slotsData) {
        this.slots = state.slotsData.map((slot: any) => ({
          ...slot,
          showStatus: false 
        }));
        this.startAutoRefresh(); 
      } else if (this.selectedCoop) {
        this.fetchSensorData();
        this.startAutoRefresh(); 
      } else {
        console.warn('No selectedCoop. API fetch aborted.');
      }
    });

    this.selectedTrackStatus = this.trackStatuses[0];
  }

  ngOnDestroy() {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  initializeEmptySlots() {
    this.slots = Array.from({ length: 21 }, (_, i) => ({
      id: i,
      device: null,
      status: 'offline',
      showStatus: false
    }));
  }

  private getDevicesArray(data: any): any[] {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.devices && Array.isArray(data.devices)) return data.devices;
    if (data.Devices && Array.isArray(data.Devices)) return data.Devices;
    if (data.data) {
      if (Array.isArray(data.data)) return data.data;
      if (data.data.devices && Array.isArray(data.data.devices)) return data.data.devices;
      if (data.data.Devices && Array.isArray(data.data.Devices)) return data.data.Devices;
    }
    for (const key in data) {
      if (data.hasOwnProperty(key) && Array.isArray(data[key])) return data[key];
    }
    return [];
  }

  private getProp(obj: any, keys: string[]): any {
    if (!obj) return undefined;
    for (const key of keys) {
      if (obj[key] !== undefined) return obj[key];
    }
    const normalizedKeys = keys.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
    for (const objKey in obj) {
      if (obj.hasOwnProperty(objKey)) {
        const normalizedObjKey = objKey.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalizedKeys.includes(normalizedObjKey)) {
          return obj[objKey];
        }
      }
    }
    return undefined;
  }

  private processSensorResponse(data: any) {
    const devices = this.getDevicesArray(data);
    const activeIndices = new Set<number>();

    if (devices && devices.length > 0) {
      devices.forEach((deviceData: any) => {
        const rawIndex = this.getProp(deviceData, ['slot_index', 'slotIndex', 'SlotIndex']);
        const index = rawIndex !== undefined ? Number(rawIndex) : -1;

        if (index >= 0 && index < 21) {
          const name = this.getProp(deviceData, ['name', 'Name']) || 'Unknown';
          
          if (name.includes('ความชื้น')) {
            return;
          }

          activeIndices.add(index);
          const icon = this.getProp(deviceData, ['icon', 'Icon']) || '';

          this.slots[index].device = { name, icon };

          const rawStatus = this.getProp(deviceData, ['current_status', 'currentStatus', 'status', 'Status', 'CurrentStatus', 'state', 'State', 'is_active', 'isActive']);
          
          let isWorking = true; 
          
          if (rawStatus !== undefined && rawStatus !== null) {
            const statusStr = String(rawStatus).toLowerCase().trim();
            if (['offline', 'false', '0', 'off', 'inactive', 'disconnect', 'error'].includes(statusStr)) {
              isWorking = false;
            }
          }

          this.slots[index].status = isWorking ? 'normal' : 'offline';
        }
      });
    }

    for (let i = 0; i < 21; i++) {
      if (!activeIndices.has(i)) {
        this.slots[i].device = null;
        this.slots[i].status = 'offline';
      }
    }
    
    this.cdr.detectChanges();
  }

  fetchSensorData() {
    console.log('Current selectedCoop:', this.selectedCoop);

    if (!this.selectedCoop) return;
    this.isLoading = true;
    
    this.api.get<any>(`/coops?id=${this.selectedCoop}`).subscribe({
      next: (data) => {
        this.isLoading = false;
        console.log('Data from API:', data);
        this.processSensorResponse(data);
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Failed to fetch sensor data', err);
      }
    });
  }

  startAutoRefresh() {
    if (!this.refreshSubscription) {
      this.refreshSubscription = interval(5000).subscribe(() => {
        this.fetchSensorDataSilently();
      });
    }
  }

  fetchSensorDataSilently() {
    if (!this.selectedCoop) return;
    
    this.api.get<any>(`/coops?id=${this.selectedCoop}`).subscribe({
      next: (data) => {
        this.processSensorResponse(data);
      }
    });
  }

  onTrackChange(event: any) {
    const trackId = event.target.value;
    this.selectedTrackStatus = this.trackStatuses.find(t => t.id === trackId);
  }

  setTooltipVisible(slot: SlotData, visible: boolean) {
    if (slot.device) {
      slot.showStatus = visible;
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'normal': return 'ออนไลน์ (กำลังทำงาน)';
      case 'offline': return 'ออฟไลน์ (ไม่ได้ทำงาน)';
      case 'empty': return 'ยังไม่ได้เพิ่มอุปกรณ์'; 
      default: return 'ออฟไลน์';
    }
  }

  getSensorsForSelectedTrack() {
    if (!this.selectedTrackStatus) return [];
    
    let startIndex = 0;
    let endIndex = 7;

    if (this.selectedTrackStatus.id === 'top') { 
      startIndex = 0; endIndex = 7; 
    } else if (this.selectedTrackStatus.id === 'middle') { 
      startIndex = 7; endIndex = 14; 
    } else if (this.selectedTrackStatus.id === 'bottom') { 
      startIndex = 14; endIndex = 21; 
    }

    return this.slots.slice(startIndex, endIndex).filter(slot => slot.device);
  }
}