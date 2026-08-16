import { Component, OnInit, ChangeDetectorRef } from '@angular/core'; // 🌟 1. นำเข้า OnInit และ ChangeDetectorRef
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service'; // 🌟 2. นำเข้า ApiService สำหรับยิง API

// โครงสร้างข้อมูลแต่ละคอก (ปรับให้รับแค่เลขคอก)
interface Coop {
  coop_id: number;
}

@Component({
  selector: 'app-chicken-sensor-system',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule], 
  templateUrl: './Chicken_sensor_System.html',
  styleUrls: ['./Chicken_sensor_System.scss']
})
export class ChickensensorSystemComponent implements OnInit {

  // ปล่อยเป็น Array ว่างไว้ รอรับข้อมูลจาก Database
  coops: Coop[] = [];

  constructor(
    private router: Router,
    private api: ApiService, // 🌟 3. Inject ApiService เข้ามาใช้งาน
    private cdr: ChangeDetectorRef // 🌟 4. Inject ChangeDetectorRef
  ) {}

  // จะทำงานทันทีเมื่อหน้านี้ถูกโหลด
  ngOnInit(): void {
    this.loadCoopsFromDatabase();
  }

  // ฟังก์ชันดึงเลขคอกไก่จาก Database
  loadCoopsFromDatabase() {
    this.api.get<any[]>(`/coops`).subscribe({
      next: (data: any[]) => {
        // ใช้ .map() ดึงมาเฉพาะรหัสคอก
        this.coops = data.map(item => {
          return { coop_id: item.coop_id || item.id };
        });

        console.log('ดึงเฉพาะเลขคอกสำเร็จ:', this.coops);
        this.cdr.detectChanges(); // บังคับให้ Angular วาดกล่องคอกไก่ขึ้นหน้าจอทันที
      },
      error: (err: any) => {
        console.error('ดึงข้อมูลล้มเหลว:', err);
      }
    });
  }

  // ฟังก์ชันเมื่อกดเลือกคอก
  selectCoop(coop: Coop) {
    const finalNumber = coop.coop_id ? coop.coop_id.toString() : '';
    
    console.log('กำลังเปิดสถานะคอกไก่ที่:', finalNumber);
    
    // แนบข้อมูล state (เลขคอก) ไปพร้อมกับการเปลี่ยนหน้า
    this.router.navigate(['/system-sensor'], { 
      state: { coopNumber: finalNumber } 
    });
  }
}