import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { CdkDragDrop, moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop';
import { Coop } from '../../shared/coop-summary.util';
import { CoopHoverCard } from '../../shared/coop-hover-card/coop-hover-card';

@Component({
  selector: 'app-home-pages1',
  standalone: true,
  imports: [CommonModule, RouterModule, DragDropModule, CoopHoverCard],
  templateUrl: './Home_pages1.html',
  styleUrls: ['./Home_pages1.scss']
})
export class HomePages1 implements OnInit {

  coops: Coop[] = [];
  tooltipDeviceId: number | null = null;
  hoveredCoopId: number | null = null;

  constructor(
    private router: Router,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCoops();
  }

  loadCoops() {
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

  selectCoop(coop: Coop) {
    this.router.navigate(['/data-coop'], {
      state: { coopNumber: coop.coop_id?.toString() }
    });
  }

  editCoop(event: Event, coop: Coop) {
    event.stopPropagation();
    this.router.navigate(['/edit-coop'], { queryParams: { id: coop.coop_id } });
  }

  openTemperatureSettings() {
  }

  drop(event: CdkDragDrop<Coop[]>) {
    moveItemInArray(this.coops, event.previousIndex, event.currentIndex);
  }
}
