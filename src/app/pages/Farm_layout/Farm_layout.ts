import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { CoopHoverCard } from '../../shared/coop-hover-card/coop-hover-card';
import { Coop } from '../../shared/coop-summary.util';

type FarmShape = 'circle' | 'triangle' | 'square';

@Component({
  selector: 'app-farm-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, CoopHoverCard],
  templateUrl: './Farm_layout.html',
  styleUrls: ['./Farm_layout.scss'],
})
export class FarmLayoutComponent implements OnInit {
  coops: Coop[] = [];
  shape: FarmShape = 'circle';

  draggedCoop: Coop | null = null;
  hoveredCoopId: number | null = null;

  isSaving = false;
  showToast = false;
  toastMessage = '';
  showConfirmModal = false;

  // จุดยอดสามเหลี่ยมในพื้นที่ % (0-100) ตรงกับ viewBox ของ SVG พอดี
  private readonly triangle = {
    a: { x: 50, y: 4 },
    b: { x: 4, y: 96 },
    c: { x: 96, y: 96 },
  };

  // ขอบเขตสี่เหลี่ยมในพื้นที่ % (0-100) ตรงกับ <rect> ของ SVG พอดี
  private readonly square = { min: 4, max: 96 };

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCoops();
    this.loadShape();
  }

  loadCoops() {
    this.api.get<Coop[]>('/coops').subscribe({
      next: (data) => {
        this.coops = data || [];
        this.cdr.detectChanges();
      },
      error: (err) => console.error('ดึงข้อมูลคอกไก่ล้มเหลว:', err),
    });
  }

  loadShape() {
    this.api.get<{ shape: FarmShape }>('/farm-layout').subscribe({
      next: (data) => {
        if (data?.shape) this.shape = data.shape;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('ดึงข้อมูลผังฟาร์มล้มเหลว:', err),
    });
  }

  get unplacedCoops(): Coop[] {
    return this.coops.filter((c) => c.pos_x == null || c.pos_y == null);
  }

  get placedCoops(): Coop[] {
    return this.coops.filter((c) => c.pos_x != null && c.pos_y != null);
  }

  selectShape(shape: FarmShape) {
    if (this.shape === shape) return;
    this.shape = shape;

    // เปลี่ยนรูปทรงแล้วขอบเขตเปลี่ยนไป ตำแหน่งเดิมอาจไม่พอดีกับทรงใหม่ จึงเคลียร์ตำแหน่งทั้งหมด
    // ให้ผู้ใช้เริ่มจัดวางใหม่ (ยังไม่ได้บันทึกจนกว่าจะกด "บันทึกผังฟาร์ม" จึงย้อนกลับได้เสมอ)
    const hadPlacements = this.placedCoops.length > 0;
    this.coops.forEach((c) => {
      c.pos_x = null;
      c.pos_y = null;
    });

    if (hadPlacements) {
      this.toastMessage = `เปลี่ยนเป็น${this.shapeLabel}แล้ว เริ่มจัดวางคอกใหม่ได้เลย`;
      this.flashToast();
    }
  }

  get shapeLabel(): string {
    if (this.shape === 'circle') return 'วงกลม';
    if (this.shape === 'square') return 'สี่เหลี่ยม';
    return 'สามเหลี่ยม';
  }

  // เริ่มลากคอกจากถาด "ยังไม่ได้วาง" หรือจากตำแหน่งที่วางอยู่แล้วบนแคนวาส (ใช้ตัวแปรเดียว
  // ได้เพราะตำแหน่งเก็บอยู่ที่ตัว coop เองอยู่แล้ว ไม่เหมือนหน้าอุปกรณ์ที่แยก slot)
  onDragStart(event: DragEvent, coop: Coop) {
    this.draggedCoop = coop;
    event.dataTransfer?.setData('text/plain', String(coop.coop_id));
  }

  onCanvasDragOver(event: DragEvent) {
    event.preventDefault();
  }

  onCanvasDrop(event: DragEvent) {
    event.preventDefault();
    if (!this.draggedCoop) return;

    const canvasEl = event.currentTarget as HTMLElement;
    const rect = canvasEl.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    if (this.isInsideShape(x, y)) {
      this.draggedCoop.pos_x = x;
      this.draggedCoop.pos_y = y;
    } else {
      this.toastMessage = `วางได้แค่ภายใน${this.shapeLabel}เท่านั้น`;
      this.flashToast();
    }

    this.draggedCoop = null;
    this.cdr.detectChanges();
  }

  unplace(coop: Coop) {
    coop.pos_x = null;
    coop.pos_y = null;
  }

  private isInsideShape(x: number, y: number): boolean {
    if (this.shape === 'circle') return this.isInsideCircle(x, y);
    if (this.shape === 'square') return this.isInsideSquare(x, y);
    return this.isInsideTriangle(x, y);
  }

  private isInsideCircle(x: number, y: number): boolean {
    const dx = x - 50;
    const dy = y - 50;
    return dx * dx + dy * dy <= 48 * 48;
  }

  private isInsideSquare(x: number, y: number): boolean {
    const { min, max } = this.square;
    return x >= min && x <= max && y >= min && y <= max;
  }

  private isInsideTriangle(x: number, y: number): boolean {
    const { a, b, c } = this.triangle;
    const sign = (
      p1: { x: number; y: number },
      p2: { x: number; y: number },
      p3: { x: number; y: number }
    ) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);

    const p = { x, y };
    const d1 = sign(p, a, b);
    const d2 = sign(p, b, c);
    const d3 = sign(p, c, a);

    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
  }

  // เปิดป็อบอัพถามยืนยันก่อนบันทึกจริง กันคนกดพลาดจนตำแหน่งที่จัดไว้หายไป
  openConfirmModal() {
    this.showConfirmModal = true;
  }

  cancelConfirm() {
    this.showConfirmModal = false;
  }

  confirmSave() {
    this.showConfirmModal = false;
    this.saveLayout();
  }

  saveLayout() {
    this.isSaving = true;

    this.api.put<any>('/farm-layout', { shape: this.shape }).subscribe({
      next: () => this.savePositions(),
      error: (err) => {
        console.error('บันทึกรูปทรงผังฟาร์มล้มเหลว:', err);
        this.savePositions(); // ยังพยายามบันทึกตำแหน่งต่อ แม้ผังรูปทรงจะบันทึกไม่สำเร็จ
      },
    });
  }

  private savePositions() {
    const positions = this.coops.map((c) => ({
      coop_id: c.coop_id,
      pos_x: c.pos_x ?? null,
      pos_y: c.pos_y ?? null,
    }));

    this.api.put<any>('/coops/positions', { positions }).subscribe({
      next: () => {
        this.isSaving = false;
        this.toastMessage = 'บันทึกผังฟาร์มเรียบร้อย!';
        this.flashToast(() => this.router.navigate(['/home']));
      },
      error: (err) => {
        this.isSaving = false;
        console.error('บันทึกตำแหน่งคอกล้มเหลว:', err);
        this.toastMessage = 'เกิดข้อผิดพลาดในการบันทึก';
        this.flashToast();
      },
    });
  }

  private flashToast(onDone?: () => void) {
    this.showToast = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.showToast = false;
      this.cdr.detectChanges();
      onDone?.();
    }, 2000);
  }
}
