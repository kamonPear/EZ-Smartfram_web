import { Component, EventEmitter, Input, OnInit, Output, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { deviceIconSrc, DEVICE_ICON_CHOICES } from '../../shared/device-icon.util';
import { legacyGridPosition } from '../../shared/coop-summary.util';
import { ConfirmService, thDate } from '../../services/confirm.service';
@Component({
  selector: 'app-set-up-system',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './Set_up_System.html',
  styleUrls: ['./Set_up_System.scss']
})
export class SetUpSystem implements OnInit {
  private confirm = inject(ConfirmService);

  // ใช้ฝังในป็อบอัพของหน้าแก้ไขคอก (Edit_coop) - ส่ง id คอกมาตรงๆ แทนการอ่านจาก URL
  // และไม่เด้งไปหน้าอื่นตอนบันทึก (ยิง saved ให้หน้าที่ครอบอยู่ปิดป็อบอัพเอง)
  @Input() embeddedCoopId: string | number | null = null;
  @Output() saved = new EventEmitter<void>();

  get isEmbedded(): boolean {
    return this.embeddedCoopId !== null && this.embeddedCoopId !== undefined;
  }

  deviceIconSrc = deviceIconSrc;

  // เริ่มจากถาดว่างจนกว่าโหลดชนิดอุปกรณ์ของ user จาก backend เสร็จ - ไม่มีค่าตั้งต้น
  // ฝังไว้แล้ว เพราะ user ใหม่ต้องเพิ่มชนิดอุปกรณ์เองทั้งหมด (ไม่ให้ชนิดที่ user
  // ไม่ได้เพิ่มโผล่ขึ้นมาเอง)
  availableSensors: { id?: number; name: string; icon: string }[] = [];
  typesLoaded = false;

  readonly iconChoices = DEVICE_ICON_CHOICES;

  // ป็อบอัพจัดการชนิดอุปกรณ์ (คลิกที่ชื่อในถาดด้านซ้าย - ทุกตัวคลิกได้ รวมถึง 7 แบบ
  // มาตรฐาน เพราะ backend seed เป็นแถวจริงให้ user ทุกคนแล้ว แก้ไข/ลบถาวรได้หมด) -
  // id = null เกิดได้แค่ตอนคลิกระหว่างที่ยังโหลดจาก backend ไม่เสร็จ (ใช้ builtInSensors
  // ตั้งต้นซึ่งไม่มี id) กรณีนี้โชว์ข้อมูลอย่างเดียวไปก่อน กันปุ่มแก้ไข/ลบพังเพราะยังไม่มี id จริง
  managingType: { id: number | null; name: string; icon: string } | null = null;
  editName = '';
  editIcon = '';
  isSavingEdit = false;
  isDeletingType = false;
  showDeleteTypeConfirm = false;

  slots: any[] = [];
  selectedCoop: string | null = null;
  selectedCoopName: string | null = null;

  draggedSensor: any = null;
  draggedSlotId: number | null = null;

  showToast: boolean = false;
  toastMessage: string = '';
  isSaving: boolean = false; 

  constructor(
    private cdr: ChangeDetectorRef, 
    private route: ActivatedRoute, 
    private router: Router, 
    private api: ApiService
  ) {}

  ngOnInit() {
    // 🌟 1. สร้างช่องว่าง 21 ช่องเตรียมรอไว้เลยตั้งแต่เปิดหน้า
    // x/y คือตำแหน่งเริ่มต้น (%) ที่คำนวณจากตาราง 7x3 เดิม ใช้แค่วางจุดเริ่มต้น
    // ผู้ใช้ลากเปลี่ยนตำแหน่งได้อิสระในหน้าเว็บ (ไม่ผูกกับ grid อีกต่อไป)
    this.slots = Array.from({ length: 21 }, (_, i) => {
      const row = Math.floor(i / 7);
      const col = i % 7;
      return {
        id: i,
        device: null,
        status: 'normal',
        x: ((col + 0.5) / 7) * 100,
        y: ((row + 0.5) / 3) * 100
      };
    });

    // อ่านค่า URL ว่ากดมาจากคอกไหน (โหมดฝังในป็อบอัพใช้ embeddedCoopId แทน)
    if (this.isEmbedded) {
      this.selectedCoop = String(this.embeddedCoopId);
      this.fetchCoopData();
    }
    this.route.queryParams.subscribe(params => {
      if (!this.isEmbedded && params['coop']) {
        this.selectedCoop = params['coop'];
        this.fetchCoopData(); // 🌟 2. สั่งดึงข้อมูลอุปกรณ์ของคอกนี้
      }
    });

    this.fetchCustomDeviceTypes();
  }

  // ชนิดอุปกรณ์ทั้งหมดของ user นี้ (มาตรฐาน 7 แบบที่ backend seed ให้ + ที่เพิ่มเอง)
  // แทนที่ค่าตั้งต้นทั้งก้อนเสมอเมื่อโหลดสำเร็จ แม้ backend จะตอบ "array ว่าง" กลับมา
  // จริงๆ ก็ตาม (เช่น user ลบชนิดอุปกรณ์ทิ้งจนหมดแล้วจริงๆ) - ต้องแทนที่ไม่ใช่แค่ตอน
  // ยาวกว่า 0 เพราะงั้นถาดจะค้างโชว์ placeholder 7 แบบที่ไม่มี id จริงให้จัดการตลอด
  // ไป ทำให้ดูเหมือนมีอุปกรณ์ "โผล่มาเอง" ทั้งที่ user ไม่ได้เพิ่มและลบไปหมดแล้ว
  // ไม่แทนที่แค่ตอน request ตัวเอง fail จริงๆ (error callback) เท่านั้น
  private fetchCustomDeviceTypes() {
    this.api.get<{ id: number; name: string; icon: string }[]>('/device-types').subscribe({
      next: (rows) => {
        this.availableSensors = rows || [];
        this.typesLoaded = true;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('โหลดชนิดอุปกรณ์ไม่สำเร็จ:', err),
    });
  }

  // คลิก (ไม่ใช่ลาก) ที่ชนิดอุปกรณ์ในถาด - เปิดป็อบอัพจัดการเสมอ ไม่ว่าจะเป็นชนิด
  // มาตรฐานหรือที่เพิ่มเอง (เทมเพลตจะโชว์ปุ่มแก้ไข/ลบแค่ตอน managingType.id ไม่ใช่
  // null เท่านั้น - ดู saveEditedType/deleteManagedType ที่กันไว้อีกชั้นด้วย)
  onPaletteItemClick(sensor: { id?: number; name: string; icon: string }) {
    this.managingType = { id: sensor.id ?? null, name: sensor.name, icon: sensor.icon };
    this.editName = sensor.name;
    this.editIcon = sensor.icon;
    this.showDeleteTypeConfirm = false;
    this.cdr.detectChanges();
  }

  closeManageModal() {
    this.managingType = null;
    this.showDeleteTypeConfirm = false;
    this.cdr.detectChanges();
  }

  selectEditIcon(src: string) {
    this.editIcon = src;
  }

  async saveEditedType() {
    if (!this.managingType || this.managingType.id == null) return;
    const trimmedName = this.editName.trim();
    if (!trimmedName || !this.editIcon) return;

    // ให้เจ้าของฟาร์มทวนข้อมูลอีกรอบก่อนบันทึกจริง (ป็อบอัพกลาง services/confirm.service.ts)
    if (!(await this.confirm.ask({ message: 'บันทึกการแก้ไขชนิดอุปกรณ์ใช่ไหม?', details: [`ชื่ออุปกรณ์: ${trimmedName}`] }))) return;
    this.isSavingEdit = true;
    this.api.put<{ id: number; name: string; icon: string }>(`/device-types?id=${this.managingType.id}`, {
      name: trimmedName,
      icon: this.editIcon,
    }).subscribe({
      next: (updated) => {
        this.isSavingEdit = false;
        const idx = this.availableSensors.findIndex((s) => s.id === this.managingType?.id);
        if (idx !== -1) this.availableSensors[idx] = updated;
        this.toastMessage = 'แก้ไขอุปกรณ์สำเร็จ!';
        this.showToast = true;
        this.closeManageModal();
        setTimeout(() => { this.showToast = false; this.cdr.detectChanges(); }, 2500);
      },
      error: (err) => {
        this.isSavingEdit = false;
        console.error('แก้ไขชนิดอุปกรณ์ไม่สำเร็จ:', err);
        const serverMsg = typeof err.error === 'string' ? err.error.trim() : '';
        this.toastMessage = serverMsg || 'แก้ไขอุปกรณ์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
        this.showToast = true;
        this.cdr.detectChanges();
        setTimeout(() => { this.showToast = false; this.cdr.detectChanges(); }, 2500);
      }
    });
  }

  deleteManagedType() {
    if (!this.managingType || this.managingType.id == null) return;
    this.isDeletingType = true;
    this.api.delete(`/device-types?id=${this.managingType.id}`).subscribe({
      next: () => {
        this.isDeletingType = false;
        this.availableSensors = this.availableSensors.filter((s) => s.id !== this.managingType?.id);
        this.toastMessage = 'ลบอุปกรณ์แล้ว';
        this.showToast = true;
        this.closeManageModal();
        setTimeout(() => { this.showToast = false; this.cdr.detectChanges(); }, 2500);
      },
      error: (err) => {
        this.isDeletingType = false;
        console.error('ลบชนิดอุปกรณ์ไม่สำเร็จ:', err);
        this.toastMessage = 'ลบอุปกรณ์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
        this.showToast = true;
        this.cdr.detectChanges();
        setTimeout(() => { this.showToast = false; this.cdr.detectChanges(); }, 2500);
      }
    });
  }

  fetchCoopData() {
    if (!this.selectedCoop) return;
    
    // ดึงข้อมูลอุปกรณ์จาก API 
    // (หมายเหตุ: ถ้า API ฝั่ง Go ที่ดึงอุปกรณ์ชื่ออื่น ให้เปลี่ยน URL ตรงนี้ด้วยนะครับ)
    this.api.get<any>(`/coops?id=${this.selectedCoop}`).subscribe({
      next: (data) => {
        this.selectedCoopName = data?.name_coop || null;

        // 🌟 3. ดักจับรูปแบบข้อมูลจาก Go (อาจจะมาในชื่อ devices, slots, หรือมาเป็น Array ตรงๆ)
        const fetchedDevices = data?.devices || data?.slots || (Array.isArray(data) ? data : []);

        if (fetchedDevices && fetchedDevices.length > 0) {
          
          // เลขอุปกรณ์ (slot_index) เป็นเลขรันต่อคอกที่ backend ออกให้ ไม่ใช่เลขช่องบนกริดอีกแล้ว - ใส่อุปกรณ์
          // ลงช่องว่างของกริดเรียงตามเลข ส่วนตำแหน่งที่แสดงใช้พิกัดที่บันทึกไว้ (ถ้ายังไม่มีใช้ตำแหน่งกริดเดิมตามเลข)
          const sorted = [...fetchedDevices].sort((a: any, b: any) => (a.slot_index ?? a.id ?? 0) - (b.slot_index ?? b.id ?? 0));
          let cell = 0;
          sorted.forEach((dbDevice: any) => {
            while (cell < this.slots.length && this.slots[cell].device) cell++;
            if (cell >= this.slots.length) return; // เกิน 21 ตัวที่ผังรองรับ
            const slot = this.slots[cell];

            // กรณี Database ส่งค่ามาเป็น name และ icon ตรงๆ (แบบโครงสร้าง GORM ของคุณ)
            if (dbDevice.name && dbDevice.icon) {
              slot.device = {
                name: dbDevice.name,
                icon: dbDevice.icon,
                // เลขที่ backend ออกให้ - ส่งกลับไปตอนบันทึกเพื่อให้รู้ว่าเป็นตัวเดิม (คงเลขเดิม)
                slot_index: dbDevice.slot_index
              };
              slot.status = 'working';
              if (dbDevice.pos_x != null && dbDevice.pos_y != null) {
                slot.x = dbDevice.pos_x;
                slot.y = dbDevice.pos_y;
              } else {
                const fallback = legacyGridPosition(dbDevice.slot_index);
                if (fallback) {
                  slot.x = fallback.x;
                  slot.y = fallback.y;
                }
              }
              cell++;
            }
            // กรณีส่งมาเป็นรูปแบบ Object device ย่อยแบบเดิม
            else if (dbDevice.device) {
              slot.device = { ...dbDevice.device };
              slot.status = dbDevice.status || 'working';
              cell++;
            }
          });
        }
        
        // 🌟 4. บังคับให้ Angular อัปเดตหน้าจอเพื่อนำรูปอุปกรณ์ขึ้นมาแสดง
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to fetch coop data', err);
      }
    });
  }

  get placedSlots() {
    return this.slots.filter(s => s.device);
  }

  // เริ่มลากอุปกรณ์ใหม่จากถาดรายการด้านข้าง
  onPaletteDragStart(event: DragEvent, sensor: any) {
    this.draggedSensor = sensor;
    this.draggedSlotId = null;
    event.dataTransfer?.setData('text/plain', sensor.name);
  }

  // เริ่มลากอุปกรณ์ที่วางอยู่แล้วเพื่อย้ายตำแหน่ง
  onDeviceDragStart(event: DragEvent, slot: any) {
    this.draggedSlotId = slot.id;
    this.draggedSensor = null;
    event.dataTransfer?.setData('text/plain', String(slot.id));
    event.stopPropagation();
  }

  onCanvasDragOver(event: DragEvent) {
    event.preventDefault();
  }

  // ปล่อยอุปกรณ์ลงตำแหน่งใดก็ได้บนแคนวาส
  onCanvasDrop(event: DragEvent) {
    event.preventDefault();
    const canvasEl = event.currentTarget as HTMLElement;
    const rect = canvasEl.getBoundingClientRect();
    const x = Math.min(97, Math.max(3, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(94, Math.max(6, ((event.clientY - rect.top) / rect.height) * 100));

    // ห้ามวางทับเซนเซอร์ตัวอื่น - ถ้าตำแหน่งที่ปล่อยชนกับตัวที่วางอยู่แล้ว ไม่ย้าย/ไม่วางให้
    // (ตัวที่ลากอยู่ยังอยู่ที่เดิม) แล้วแจ้งผู้ใช้ให้ปล่อยในที่ว่าง
    const draggedName = this.draggedSlotId !== null
      ? this.slots.find(s => s.id === this.draggedSlotId)?.device?.name
      : this.draggedSensor?.name;
    if (this.wouldOverlap(canvasEl, x, y, this.draggedSlotId, draggedName || '')) {
      this.draggedSensor = null;
      this.draggedSlotId = null;
      this.toastMessage = 'ตำแหน่งนี้มีเซนเซอร์วางอยู่แล้ว กรุณาวางในที่ว่าง';
      this.showToast = true;
      this.cdr.detectChanges();
      setTimeout(() => { this.showToast = false; this.cdr.detectChanges(); }, 2500);
      return;
    }

    if (this.draggedSlotId !== null) {
      const currentSlot = this.slots.find(s => s.id === this.draggedSlotId);
      if (currentSlot && currentSlot.device) {
        // slot_index ยังเป็นตัวระบุอุปกรณ์ (บอร์ดส่ง coop_id + slot_index มาจับคู่) จึงต้อง
        // ย้ายอุปกรณ์ไปอยู่ในช่องว่างที่ใกล้จุดปล่อยที่สุด ส่วนตำแหน่งที่แสดงจริง (x/y)
        // backend เก็บให้แยกต่างหากเป็น pos_x/pos_y จึงอยู่ตรงจุดที่วางแม้ reload
        const target = this.findNearestEmptySlot(x, y);
        if (target) {
          target.device = currentSlot.device;
          target.status = currentSlot.status;
          target.x = x;
          target.y = y;
          currentSlot.device = null;
          currentSlot.status = 'normal';
        } else {
          // ไม่มีช่องว่างให้ย้าย (ทุกช่องเต็มพอดี) แค่ขยับตำแหน่งที่แสดงผลไปก่อน
          currentSlot.x = x;
          currentSlot.y = y;
        }
      }
    } else if (this.draggedSensor) {
      const target = this.findNearestEmptySlot(x, y);
      if (!target) {
        alert('วางอุปกรณ์ครบจำนวนที่รองรับแล้ว');
      } else {
        target.device = { ...this.draggedSensor };
        target.status = 'working';
        target.x = x;
        target.y = y;
      }
    }

    this.draggedSensor = null;
    this.draggedSlotId = null;
    this.cdr.detectChanges();
  }

  // เช็กว่าชิปเซนเซอร์ที่จะวางตรงจุด (x%, y%) จะทับชิปตัวอื่นบนแคนวาสไหม - เทียบเป็นพิกเซล
  // จากขนาดจริงบนหน้าจอ (ชิปกว้างตามความยาวชื่อ) ชิปทุกตัวใช้ translate(-50%,-50%) จุดที่เก็บ
  // จึงเป็นจุดกึ่งกลางชิป ignoreSlotId = ช่องของชิปที่กำลังย้ายอยู่ (ไม่นับว่าชนกับตัวเอง)
  private wouldOverlap(canvasEl: HTMLElement, x: number, y: number, ignoreSlotId: number | null, name: string): boolean {
    const canvasRect = canvasEl.getBoundingClientRect();
    const cx = (x / 100) * canvasRect.width;
    const cy = (y / 100) * canvasRect.height;

    let w: number;
    let h: number;
    const movingEl = ignoreSlotId !== null
      ? canvasEl.querySelector<HTMLElement>(`.free-slot[data-slot-id="${ignoreSlotId}"]`)
      : null;
    if (movingEl) {
      const r = movingEl.getBoundingClientRect();
      w = r.width;
      h = r.height;
    } else {
      // ลากใหม่จากถาด ยังไม่มีชิปบนแคนวาสให้วัด - ประมาณจากความยาวชื่อ (ไอคอน + ช่องไฟ + ตัวอักษร)
      w = 50 + name.length * 8;
      h = 34;
    }

    const gap = 6;
    const others = canvasEl.querySelectorAll<HTMLElement>('.free-slot[data-slot-id]');
    for (const el of Array.from(others)) {
      if (Number(el.dataset['slotId']) === ignoreSlotId) continue;
      const r = el.getBoundingClientRect();
      const ox = r.left + r.width / 2 - canvasRect.left;
      const oy = r.top + r.height / 2 - canvasRect.top;
      if (Math.abs(cx - ox) < (w + r.width) / 2 + gap && Math.abs(cy - oy) < (h + r.height) / 2 + gap) {
        return true;
      }
    }
    return false;
  }

  // หาช่องว่างที่ "ตำแหน่งเริ่มต้น" (คำนวณจาก slot_index) อยู่ใกล้จุดที่ปล่อยมากที่สุด
  private findNearestEmptySlot(x: number, y: number) {
    let nearest: any = null;
    let nearestDist = Infinity;
    for (const s of this.slots) {
      if (s.device) continue;
      const row = Math.floor(s.id / 7);
      const col = s.id % 7;
      const defaultX = ((col + 0.5) / 7) * 100;
      const defaultY = ((row + 0.5) / 3) * 100;
      const dist = Math.hypot(defaultX - x, defaultY - y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = s;
      }
    }
    return nearest;
  }

  isModalOpen: boolean = false;
  slotToDelete: number | null = null;

  removeDevice(slotIndex: number) {
    this.slotToDelete = slotIndex; 
    this.isModalOpen = true;      
  }

  confirmRemove() {
    if (this.slotToDelete !== null) {
      const slotIdx = this.slotToDelete;
      const removed = this.slots[slotIdx].device;
      const removedStatus = this.slots[slotIdx].status;

      // 1. เคลียร์ค่าในหน้าจอ (Frontend)
      this.slots[slotIdx].device = null;
      this.slots[slotIdx].status = 'normal';

      // 🌟 เพิ่มบรรทัดนี้: บังคับให้ Angular วาดหน้าจอใหม่ทันที รูปเซนเซอร์จะหายวับไปเลย!
      this.cdr.detectChanges();

      // 2. ยิง API ไปลบในฐานข้อมูล (Backend) - ถ้าล้มเหลวคืนอุปกรณ์กลับเข้าช่องเดิม
      // และแจ้งผู้ใช้ ไม่ให้หน้าจอบอกว่าลบแล้วทั้งที่ยังอยู่ใน DB
      // ลบในฐานข้อมูลด้วยเลขอุปกรณ์ที่ backend ออกให้ (ไม่ใช่เลขช่องบนกริด) - อุปกรณ์ที่เพิ่งลากมาวางและยังไม่เคย
      // บันทึกไม่มีเลข จึงไม่มีอะไรให้ลบในฐานข้อมูล แค่เอาออกจากหน้าจอ
      if (this.selectedCoop && removed?.slot_index != null) {
        this.api.delete<any>(`/devices?coop_id=${this.selectedCoop}&slot_index=${removed.slot_index}`).subscribe({
          next: (res) => {
            console.log('✅ ลบข้อมูลใน Database สำเร็จ:', res);
          },
          error: (err) => {
            console.error('❌ เกิดข้อผิดพลาด ลบข้อมูลใน Database ไม่สำเร็จ:', err);
            this.slots[slotIdx].device = removed;
            this.slots[slotIdx].status = removedStatus;
            this.toastMessage = 'ลบอุปกรณ์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
            this.showToast = true;
            this.cdr.detectChanges();
            setTimeout(() => { this.showToast = false; this.cdr.detectChanges(); }, 3000);
          }
        });
      }

      this.slotToDelete = null; 
    }
    this.isModalOpen = false; 
  }

  cancelRemove() {
    this.slotToDelete = null; 
    this.isModalOpen = false; 
  }

  async saveLayout() {
    if (!this.selectedCoop) {
      console.error('No coop selected');
      return;
    }

    // ให้เจ้าของฟาร์มทวนข้อมูลอีกรอบก่อนบันทึกจริง (ป็อบอัพกลาง services/confirm.service.ts)
    const ok = await this.confirm.ask({
      message: 'บันทึกการจัดวางอุปกรณ์ในคอกนี้ใช่ไหม? ระบบจะส่งตำแหน่งอุปกรณ์ไปให้บอร์ดในคอกด้วย',
      details: [`คอก: ${this.selectedCoopName || '-'}`, `จำนวนอุปกรณ์ที่วาง: ${this.slots.filter((s: any) => s.device).length} ตัว`],
    });
    if (!ok) return;
    this.isSaving = true;

    const payload = {
      slots: this.slots 
    };

    this.api.post<any>(`/coops/layout?coop_id=${this.selectedCoop}`, payload).subscribe({
      next: (response) => {
        this.isSaving = false;
        this.toastMessage = 'บันทึกการจัดวางเรียบร้อย!';
        this.showToast = true;
        this.cdr.detectChanges();

        setTimeout(() => {
          this.showToast = false; 
          this.cdr.detectChanges();

          if (this.isEmbedded) {
            this.saved.emit();
            return;
          }
          this.router.navigate(['/data-coop'], {
            state: { 
              slotsData: this.slots, 
              coopNumber: this.selectedCoop 
            } 
          });
        }, 1500);
      },
      error: (err) => {
        this.isSaving = false;
        console.error('Failed to save layout', err);
        
        this.toastMessage = 'เกิดข้อผิดพลาดในการบันทึกข้อมูล!';
        this.showToast = true;
        this.cdr.detectChanges();
        
        setTimeout(() => {
          this.showToast = false;
          this.cdr.detectChanges();
        }, 3000);
      }
    });
  }
}