import { Component, OnInit, ChangeDetectorRef } from '@angular/core'; 
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router'; 
import { ApiService } from '../../services/api.service';
@Component({
  selector: 'app-set-up-system',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './Set_up_System.html',
  styleUrls: ['./Set_up_System.scss']
})
export class SetUpSystem implements OnInit {
  
  availableSensors = [
    { name: 'ESP 32', icon: 'assets/images/esp32.png' },
    { name: 'MQ-135', icon: 'assets/images/mq135.png' },
    { name: 'PIR MOTION', icon: 'assets/images/pir.png' },
    { name: 'DHT22', icon: 'assets/images/ds18b20.png' },
    { name: 'MC-38', icon: 'assets/images/mc38.png' },
    { name: 'พัดลม', icon: 'assets/images/fan.png' },
    { name: 'หลอดไฟ', icon: 'assets/images/bulb.png' }
  ];

  slots: any[] = [];
  openDropdownIndex: number | null = null;
  selectedCoop: string | null = null; 

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
    this.slots = Array.from({ length: 21 }, (_, i) => ({
      id: i,
      device: null,
      status: 'normal'
    }));

    // อ่านค่า URL ว่ากดมาจากคอกไหน
    this.route.queryParams.subscribe(params => {
      if (params['coop']) {
        this.selectedCoop = params['coop'];
        this.fetchCoopData(); // 🌟 2. สั่งดึงข้อมูลอุปกรณ์ของคอกนี้
      }
    });
  }

  fetchCoopData() {
    if (!this.selectedCoop) return;
    
    // ดึงข้อมูลอุปกรณ์จาก API 
    // (หมายเหตุ: ถ้า API ฝั่ง Go ที่ดึงอุปกรณ์ชื่ออื่น ให้เปลี่ยน URL ตรงนี้ด้วยนะครับ)
    this.api.get<any>(`/coops?id=${this.selectedCoop}`).subscribe({
      next: (data) => {
        
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

  toggleDropdown(index: number) {
    if (this.openDropdownIndex === index) {
      this.openDropdownIndex = null; 
    } else {
      this.openDropdownIndex = index; 
    }
  }

  selectDevice(slotIndex: number, sensor: any) {
    this.slots[slotIndex].device = { ...sensor };
    this.slots[slotIndex].status = 'working'; 
    this.openDropdownIndex = null; 
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
        this.api.delete<any>(`/api/devices?coop_id=${this.selectedCoop}&slot_index=${slotIdx}`).subscribe({
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

          this.router.navigate(['/system-sensor'], { 
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