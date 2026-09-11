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

  constructor(
    private router: Router,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCoopsFromDatabase();
  }

  loadCoopsFromDatabase() {
    this.api.get<Coop[]>(`/coops`).subscribe({
      next: (data) => {
        this.coops = data || [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('ดึงข้อมูลล้มเหลว:', err);
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
