import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Coop, deviceSummary } from '../../shared/coop-summary.util';

@Component({
  selector: 'app-arrange-equipment',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './Arrange_equipment.html',
  styleUrls: ['./Arrange_equipment.scss']
})
export class ArrangeEquipmentComponent implements OnInit {

  coops: Coop[] = [];
  // เดิมไม่มี isLoading เลย - ระหว่างรอโหลด coops ยังเป็น [] อยู่ ทำให้ข้อความ
  // "ยังไม่มีคอกไก่ในระบบ" โผล่ขึ้นมาก่อนชั่วครู่ (ดูเหมือนไม่มีคอกทั้งที่มีจริง)
  isLoading = true;
  // การ์ดโครงร่างระหว่างโหลด ใช้แค่ให้ *ngFor วนสร้างจำนวนที่ต้องการ
  skeletonPlaceholders = [0, 1, 2];

  constructor(
    private router: Router,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCoopsFromDatabase();
  }

  loadCoopsFromDatabase() {
    this.isLoading = true;
    this.api.get<Coop[]>(`/coops`).subscribe({
      next: (data) => {
        this.coops = data || [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('ดึงข้อมูลล้มเหลว:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  deviceCount(coop: Coop): number {
    return deviceSummary(coop).total;
  }

  onlineCount(coop: Coop): number {
    return deviceSummary(coop).online;
  }

  selectCoop(coop: Coop) {
    this.router.navigate(['/setup'], { queryParams: { coop: coop.coop_id.toString() } });
  }
}
