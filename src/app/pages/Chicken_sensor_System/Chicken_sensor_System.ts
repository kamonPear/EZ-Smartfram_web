import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Coop } from '../../shared/coop-summary.util';
import { deviceIconSrc } from '../../shared/device-icon.util';

@Component({
  selector: 'app-chicken-sensor-system',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './Chicken_sensor_System.html',
  styleUrls: ['./Chicken_sensor_System.scss']
})
export class ChickensensorSystemComponent implements OnInit {

  deviceIconSrc = deviceIconSrc;
  coops: Coop[] = [];
  tooltipDeviceId: number | null = null;

  constructor(
    private router: Router,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCoopsFromDatabase();
  }

  loadCoopsFromDatabase() {
    this.api.get<Coop[]>('/coops').subscribe({
      next: (data) => {
        this.coops = data || [];
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('ดึงข้อมูลคอกไก่ล้มเหลว:', err);
      }
    });
  }

  // ฟังก์ชันเมื่อกดเลือกคอก
  selectCoop(coop: Coop) {
    const finalNumber = coop.coop_id ? coop.coop_id.toString() : '';

    this.router.navigate(['/device-status'], {
      queryParams: { coop: finalNumber }
    });
  }
}
