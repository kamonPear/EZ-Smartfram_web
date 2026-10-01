import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { timeout } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { Coop, deviceSummary } from '../../shared/coop-summary.util';
import { CoopHoverCard } from '../../shared/coop-hover-card/coop-hover-card';
import { deviceIconSrc } from '../../shared/device-icon.util';

// หน้า "คอกไก่ทั้งหมด" - แยกออกมาจากหน้าแรก (Home_pages1) เพื่อให้การ์ดสถิติ
// "คอกทั้งหมด"/"ไก่ทั้งหมด" กดแล้วไปเป็นลิสต์เต็มจอจริงๆ แทนที่จะแค่เลื่อนจอ
// ลงไปหาส่วนท้ายของหน้าแรก - ใช้ตรรกะ/มาร์กอัปเดียวกับ .coop-grid ของหน้าแรก
@Component({
  selector: 'app-coop-list',
  standalone: true,
  imports: [CommonModule, RouterModule, CoopHoverCard],
  templateUrl: './Coop_list.html',
  styleUrls: ['./Coop_list.scss']
})
export class CoopListComponent implements OnInit {
  deviceIconSrc = deviceIconSrc;
  coops: Coop[] = [];
  tooltipDeviceId: number | null = null;
  hoveredCoopId: number | null = null;
  isLoading = true;
  loadError = false;
  skeletonPlaceholders = [0, 1, 2];

  constructor(
    private router: Router,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCoops();
  }

  get totalChickens(): number {
    return this.coops.reduce((sum, c) => sum + (c.amount || 0), 0);
  }

  loadCoops() {
    this.isLoading = true;
    this.loadError = false;
    this.api.get<Coop[]>('/coops').pipe(timeout(8000)).subscribe({
      next: (data) => {
        this.coops = data || [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('ดึงข้อมูลคอกไก่ล้มเหลว:', err);
        this.isLoading = false;
        this.loadError = true;
        this.cdr.detectChanges();
      }
    });
  }

  selectCoop(coop: Coop) {
    this.router.navigate(['/data-coop'], {
      state: { coopNumber: coop.coop_id?.toString() }
    });
  }

  editCoop(event: Event, coop: Coop) {
    event.stopPropagation();
    this.router.navigate(['/edit-coop'], { queryParams: { id: coop.coop_id } });
  }

  deviceSummary(coop: Coop) {
    return deviceSummary(coop);
  }
}
