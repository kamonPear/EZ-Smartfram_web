import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { CdkDragDrop, moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop';
import { Coop } from '../../shared/coop-summary.util';
import { CoopHoverCard } from '../../shared/coop-hover-card/coop-hover-card';
import { deviceIconSrc } from '../../shared/device-icon.util';

type FarmShape = 'circle' | 'triangle' | 'square';

@Component({
  selector: 'app-home-pages1',
  standalone: true,
  imports: [CommonModule, RouterModule, DragDropModule, CoopHoverCard],
  templateUrl: './Home_pages1.html',
  styleUrls: ['./Home_pages1.scss']
})
export class HomePages1 implements OnInit {

  deviceIconSrc = deviceIconSrc;
  coops: Coop[] = [];
  tooltipDeviceId: number | null = null;
  hoveredCoopId: number | null = null;
  // ป็อบอัพของพรีวิวผังฟาร์ม แยกจาก hoveredCoopId ของตารางการ์ดด้านล่างโดยเฉพาะ
  // (ใช้ id ตัวเดียวกันเคยทำให้ชี้คอกในผังแล้วป็อบอัพในตารางโผล่ขึ้นมาซ้อนด้วย)
  hoveredLayoutCoop: Coop | null = null;
  isLoading = true;
  loadError = false;
  // การ์ดโครงร่างระหว่างโหลด ใช้แค่ให้ *ngFor วนสร้างจำนวนที่ต้องการ (ไม่ผูกข้อมูลจริง)
  skeletonPlaceholders = [0, 1, 2];

  // ผังฟาร์ม (จากหน้า "จัดวางผังฟาร์ม") - โชว์พรีวิวไว้ที่หน้าแรกด้วยเลย ไม่ใช่แค่
  // บันทึกไว้เงียบๆ ผู้ใช้ถึงจะเห็นผลว่าจัดวางไปแล้วจริง
  farmShape: FarmShape = 'circle';

  constructor(
    private router: Router,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCoops();
    this.loadShape();
  }

  loadCoops() {
    this.isLoading = true;
    this.loadError = false;
    this.api.get<Coop[]>('/coops').subscribe({
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

  loadShape() {
    this.api.get<{ shape: FarmShape }>('/farm-layout').subscribe({
      next: (data) => {
        if (data?.shape) this.farmShape = data.shape;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('ดึงข้อมูลผังฟาร์มล้มเหลว:', err),
    });
  }

  // คอกที่ถูกจัดวางไว้ในผังแล้ว (มีทั้ง pos_x และ pos_y) - ใช้ตัดสินว่าจะโชว์
  // พรีวิวผังฟาร์มหรือไม่ (ถ้ายังไม่มีใครวางเลย ไม่ต้องโชว์กล่องเปล่าให้รก)
  get placedCoops(): Coop[] {
    return this.coops.filter((c) => c.pos_x != null && c.pos_y != null);
  }

  get farmShapeLabel(): string {
    if (this.farmShape === 'circle') return 'วงกลม';
    if (this.farmShape === 'square') return 'สี่เหลี่ยม';
    return 'สามเหลี่ยม';
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
