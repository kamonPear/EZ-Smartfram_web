import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { deviceIconSrc, DEVICE_ICON_CHOICES } from '../../shared/device-icon.util';
@Component({
  selector: 'app-set-up-system',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './Set_up_System.html',
  styleUrls: ['./Set_up_System.scss']
})
export class SetUpSystem implements OnInit {

  deviceIconSrc = deviceIconSrc;

  // ชนิดมาตรฐาน 7 แบบ - ใช้ไอคอน SVG ชุดเดียวกับหน้า "เพิ่มอุปกรณ์"
  // (DEVICE_ICON_CHOICES) ไม่ต้อง copy รายชื่อ/ไอคอนซ้ำอีกชุด
  readonly builtInSensors = DEVICE_ICON_CHOICES.map((c) => ({ name: c.label, icon: c.src }));

  // ชนิดอุปกรณ์มาตรฐาน 7 แบบ + ชนิดที่ผู้ใช้เพิ่มเองจากหน้า "เพิ่มอุปกรณ์"
  // (เฉพาะของฟาร์มตัวเอง) - โหลดจาก backend ตอนเปิดหน้า เลยเริ่มที่ค่ามาตรฐานไว้
  // ก่อนกันถาดว่างระหว่างรอโหลด - ตัวที่เพิ่มเองเท่านั้นที่มี id (มาจาก DB จริง)
  // ใช้แยกว่าคลิกแล้วเปิดป็อบอัพจัดการได้ไหม (มาตรฐาน 7 แบบแก้ไข/ลบไม่ได้)
  availableSensors: { id?: number; name: string; icon: string }[] = [...this.builtInSensors];

  readonly iconChoices = DEVICE_ICON_CHOICES;

  // ป็อบอัพจัดการชนิดอุปกรณ์ (คลิกที่ชื่อในถาดด้านซ้าย - ทุกตัวคลิกได้) โชว์ชื่อ/
  // ไอคอนตอนเพิ่มเข้ามา - id = null หมายถึงชนิดมาตรฐาน 7 แบบของระบบ (โชว์ข้อมูล
  // อย่างเดียว แก้ไข/ลบไม่ได้) ส่วน id จริงคือชนิดที่ผู้ใช้เพิ่มเอง แก้ไข/ลบได้เต็มที่
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

    // อ่านค่า URL ว่ากดมาจากคอกไหน
    this.route.queryParams.subscribe(params => {
      if (params['coop']) {
        this.selectedCoop = params['coop'];
        this.fetchCoopData(); // 🌟 2. สั่งดึงข้อมูลอุปกรณ์ของคอกนี้
      }
    });

    this.fetchCustomDeviceTypes();
  }

  // ชนิดอุปกรณ์ที่ผู้ใช้เพิ่มเองจากหน้า "เพิ่มอุปกรณ์" (/add-device-type) - ต่อท้าย
  // ชนิดมาตรฐาน 7 แบบในถาดเดียวกัน โหลดไม่สำเร็จก็แค่เหลือ 7 แบบมาตรฐานไว้เหมือนเดิม
  private fetchCustomDeviceTypes() {
    this.api.get<{ id: number; name: string; icon: string }[]>('/device-types').subscribe({
      next: (rows) => {
        this.availableSensors = [...this.builtInSensors, ...(rows || [])];
        this.cdr.detectChanges();
      },
      error: (err) => console.error('โหลดชนิดอุปกรณ์ที่เพิ่มเองไม่สำเร็จ:', err),
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

  saveEditedType() {
    if (!this.managingType || this.managingType.id == null) return;
    const trimmedName = this.editName.trim();
    if (!trimmedName || !this.editIcon) return;

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
          
          fetchedDevices.forEach((dbDevice: any) => {
            // หาเลขช่อง (รองรับทั้ง key ชื่อ slot_index แบบ Go และ id แบบดั้งเดิม)
            const idx = dbDevice.slot_index ?? dbDevice.id;

            // ถ้าระบุช่องถูกต้อง (อยู่ในช่วง 0-20) ให้นำข้อมูลอุปกรณ์ไปใส่ในช่องนั้น
            if (idx !== undefined && idx >= 0 && idx < 21) {
              
              // กรณี Database ส่งค่ามาเป็น name และ icon ตรงๆ (แบบโครงสร้าง GORM ของคุณ)
              if (dbDevice.name && dbDevice.icon) {
                this.slots[idx].device = {
                  name: dbDevice.name,
                  icon: dbDevice.icon
                };
                this.slots[idx].status = 'working';
              } 
              // กรณีส่งมาเป็นรูปแบบ Object device ย่อยแบบเดิม
              else if (dbDevice.device) {
                this.slots[idx].device = { ...dbDevice.device };
                this.slots[idx].status = dbDevice.status || 'working';
              }
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

    if (this.draggedSlotId !== null) {
      const currentSlot = this.slots.find(s => s.id === this.draggedSlotId);
      if (currentSlot && currentSlot.device) {
        // ระบบหลังบ้านเก็บแค่ "ช่องที่" (slot_index) ไม่มีตำแหน่ง x/y จริงๆ
        // เลยต้องย้ายอุปกรณ์ไปอยู่ในช่องว่างที่ตำแหน่งเริ่มต้นใกล้จุดที่ลากมาปล่อยที่สุด
        // เพื่อให้ตำแหน่งยังใกล้เคียงเดิมได้แม้หลัง reload / กลับเข้ามาดูใหม่
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

      // 1. เคลียร์ค่าในหน้าจอ (Frontend)
      this.slots[slotIdx].device = null; 
      this.slots[slotIdx].status = 'normal';

      // 🌟 เพิ่มบรรทัดนี้: บังคับให้ Angular วาดหน้าจอใหม่ทันที รูปเซนเซอร์จะหายวับไปเลย!
      this.cdr.detectChanges();

      // 2. ยิง API ไปลบในฐานข้อมูล (Backend)
      if (this.selectedCoop) {
        this.api.delete<any>(`/devices?coop_id=${this.selectedCoop}&slot_index=${slotIdx}`).subscribe({
          next: (res) => {
            console.log('✅ ลบข้อมูลใน Database สำเร็จ:', res);
          },
          error: (err) => {
            console.error('❌ เกิดข้อผิดพลาด ลบข้อมูลใน Database ไม่สำเร็จ:', err);
            // ถ้าระบบจริง อาจจะเด้ง Toast บอกผู้ใช้ว่าลบไม่สำเร็จ
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

  saveLayout() {
    if (!this.selectedCoop) {
      console.error('No coop selected');
      return;
    }

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