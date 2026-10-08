import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { CdkDragDrop, moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop';
import { timeout } from 'rxjs';
import { Coop, deviceSummary } from '../../shared/coop-summary.util';
import { CoopHoverCard } from '../../shared/coop-hover-card/coop-hover-card';
import { deviceIconSrc } from '../../shared/device-icon.util';
import { FarmNotification, NotificationsService } from '../../services/notifications.service';
import { DayMarker, loadCalendarMarkers } from '../../shared/calendar-markers.util';
import { DatePickerCalendar } from '../../shared/date-picker-calendar/date-picker-calendar';
import { FarmThresholdService } from '../../services/farm-threshold.service';

type FarmShape = 'circle' | 'triangle' | 'square';

@Component({
  selector: 'app-home-pages1',
  standalone: true,
  imports: [CommonModule, RouterModule, DragDropModule, CoopHoverCard, DatePickerCalendar],
  templateUrl: './Home_pages1.html',
  styleUrls: ['./Home_pages1.scss']
})
export class HomePages1 implements OnInit, OnDestroy {

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
  // เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ - ลองใหม่ให้เองเป็นลูปเบื้องหลัง ไม่ต้องรอผู้ใช้กดปุ่ม
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  // แต่ถ้าลองมานานเกิน 1 นาทีแล้วยังไม่สำเร็จ โชว์ปุ่มโหลดใหม่ให้กดเองได้ด้วย เผื่อ
  // อยากลองทันทีไม่ต้องรอรอบถัดไป
  private reconnectStartedAt: number | null = null;
  private longRetryTimer: ReturnType<typeof setTimeout> | null = null;
  showRetryButton = false;
  // เลขรันนิ่งกันสองปัญหา: (1) รีเควสต์เก่าที่ค้างนาน (เช่นจังหวะแบ็คเอนด์กำลัง
  // restart พอร์ตรับ connection ได้แต่ยังไม่ตอบ) ตอบกลับช้ากว่ารีเควสต์ใหม่ที่ยิงซ้ำ
  // เข้ามา ทำให้ผลลัพธ์เก่ามาทับผลลัพธ์ใหม่ที่เพิ่งโหลดสำเร็จ (2) ถ้ารีเควสต์ค้างไม่
  // ตอบกลับเลย ลูป retry จะหยุดเงียบๆ (เพราะ retryTimer ตั้งใน error callback ที่ไม่มี
  // วันถูกเรียก) ทำให้ดูเหมือนหน้าค้างต้องรีเฟรชเองถึงจะกลับมาทำงาน
  private requestSeq = 0;
  // ตั้งเป็น true ตอน ngOnDestroy - กัน request ที่ยังค้างอยู่ตอบ error มาทีหลังแล้ว
  // ตั้ง retry loop ใหม่ / detectChanges บน view ที่ถูกทำลายไปแล้ว
  private destroyed = false;

  // ผังฟาร์ม (จากหน้า "จัดวางผังฟาร์ม") - โชว์พรีวิวไว้ที่หน้าแรกด้วยเลย ไม่ใช่แค่
  // บันทึกไว้เงียบๆ ผู้ใช้ถึงจะเห็นผลว่าจัดวางไปแล้วจริง
  farmShape: FarmShape = 'circle';

  // แถบภาพรวมฟาร์ม + พรีวิวแจ้งเตือนล่าสุด (เพิ่มเข้ามาให้หน้าแรกดูเป็น
  // แดชบอร์ดจริงๆ ไม่ใช่แค่ลิสต์การ์ดคอกไก่โล่งๆ) - ใช้ NotificationsService
  // ตัวเดียวกับที่ไซด์บาร์ใช้ขึ้นตัวเลข ไม่ต้องมี logic แยก
  notifications: FarmNotification[] = [];
  isLoadingNotifications = true;

  // ปฏิทินรวมทั้งฟาร์ม (ไม่กรองคอกเดียว) วางคู่กับผังฟาร์ม - ใช้ตัวมาร์คเดียวกับ
  // ปฏิทินของ Data_coop แค่ไม่ส่ง coopId เลยได้มาร์คของทุกคอกรวมกัน
  dayMarkers: Map<string, DayMarker> | null = null;

  constructor(
    private router: Router,
    private api: ApiService,
    private notificationsService: NotificationsService,
    public thresholds: FarmThresholdService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCoops();
    this.loadShape();
    this.loadNotifications();
    this.loadMarkers();
    this.thresholds.load();
  }

  // ลาก conic-gradient มาเป็นวงแหวนเปอร์เซ็นต์แบบเดียวกับ EzGaugeCard ของแอปมือถือ
  // (ไม่ลากไลบรารี gauge ใหม่มาลงเว็บ แค่ CSS ธรรมดา)
  gaugeBackground(value: number, max: number, color: string): string {
    const percent = Math.min(1, Math.max(0, value / max));
    const deg = percent * 360;
    return `conic-gradient(${color} ${deg}deg, rgba(var(--fg-rgb), 0.15) ${deg}deg 360deg)`;
  }

  loadMarkers() {
    loadCalendarMarkers(this.api).subscribe({
      next: (markers) => {
        this.dayMarkers = markers;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('โหลดข้อมูลมาร์คปฏิทินไม่สำเร็จ:', err),
    });
  }

  loadNotifications() {
    this.isLoadingNotifications = true;
    this.notificationsService.load().subscribe({
      next: (list) => {
        this.notifications = list;
        this.isLoadingNotifications = false;
        this.cdr.detectChanges();
      },
      error: () => {
        // แจ้งเตือนดึงไม่ได้ก็ไม่ต้องบล็อกหน้าแรก แค่ซ่อนพรีวิวไป
        this.isLoadingNotifications = false;
        this.cdr.detectChanges();
      }
    });
  }

  get totalChickens(): number {
    return this.coops.reduce((sum, c) => sum + (c.amount || 0), 0);
  }

  get deviceOnlineCount(): number {
    return this.coops.reduce((sum, c) => sum + deviceSummary(c).online, 0);
  }

  get deviceTotalCount(): number {
    return this.coops.reduce((sum, c) => sum + deviceSummary(c).total, 0);
  }

  get latestNotifications(): FarmNotification[] {
    return this.notifications.slice(0, 3);
  }

  loadCoops() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.isLoading = true;
    this.loadError = false;
    const seq = ++this.requestSeq;
    this.api.get<Coop[]>('/coops').pipe(timeout(8000)).subscribe({
      next: (data) => {
        if (this.destroyed || seq !== this.requestSeq) return; // มีรีเควสต์ใหม่กว่าแทนที่ไปแล้ว - ผลลัพธ์นี้เก่าเกินไป
        this.coops = data || [];
        this.isLoading = false;
        this.reconnectStartedAt = null;
        this.showRetryButton = false;
        if (this.longRetryTimer) {
          clearTimeout(this.longRetryTimer);
          this.longRetryTimer = null;
        }
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        if (this.destroyed || seq !== this.requestSeq) return;
        console.error('ดึงข้อมูลคอกไก่ล้มเหลว:', err);
        this.isLoading = false;
        this.loadError = true;
        if (this.reconnectStartedAt == null) {
          this.reconnectStartedAt = Date.now();
          this.longRetryTimer = setTimeout(() => {
            this.showRetryButton = true;
            this.cdr.detectChanges();
          }, 60000);
        }
        this.cdr.detectChanges();
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null;
          this.loadCoops();
        }, 3000);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.longRetryTimer) clearTimeout(this.longRetryTimer);
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

  // ทิศของคอกในผังฟาร์ม (8 ทิศ) - เทียบตำแหน่ง pos_x/pos_y (0-100%) กับจุดกึ่งกลาง
  // ผัง (50,50) ไม่ได้อิงทิศจริงของฟาร์ม (เหมือนเข็มทิศที่ใช้แค่บอกทิศคร่าวๆ) แค่
  // บอกว่าคอกนี้อยู่ทางไหนของผังเทียบกับคอกอื่น คืน null ถ้าคอกนี้ยังไม่ได้จัดวางผัง
  private static readonly DIRECTION_LABELS = [
    'เหนือ', 'ตะวันออกเฉียงเหนือ', 'ตะวันออก', 'ตะวันออกเฉียงใต้',
    'ใต้', 'ตะวันตกเฉียงใต้', 'ตะวันตก', 'ตะวันตกเฉียงเหนือ',
  ];

  coopDirection(coop: Coop): string | null {
    if (coop.pos_x == null || coop.pos_y == null) return null;
    const dx = coop.pos_x - 50;
    const dy = coop.pos_y - 50;
    // ใกล้จุดกึ่งกลางผังเกินกว่าจะบอกทิศได้ชัดเจน
    if (Math.hypot(dx, dy) < 4) return 'กึ่งกลางผัง';

    // มุมแบบเข็มทิศ (0°=เหนือ, 90°=ตะวันออก, ตามเข็มนาฬิกา) - top(y) เพิ่มค่าลงล่าง
    // บนจอ จึงต้องกลับเครื่องหมาย dy ก่อน เพื่อให้ "ขึ้นบน" = เหนือ
    const bearing = (Math.atan2(dx, -dy) * 180) / Math.PI;
    const index = Math.round(((bearing + 360) % 360) / 45) % 8;
    return HomePages1.DIRECTION_LABELS[index];
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
