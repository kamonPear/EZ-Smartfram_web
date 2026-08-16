import { Component, OnInit, ChangeDetectorRef } from '@angular/core'; // 1. นำเข้า ChangeDetectorRef
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router'; 
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

interface Coop {
  coop_id: number;
}

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
    private cdr: ChangeDetectorRef // 2. Inject ChangeDetectorRef เข้ามา
  ) {}

  ngOnInit(): void {
    this.loadCoopsFromDatabase();
  }

  loadCoopsFromDatabase() {
    this.api.get<any[]>(`/coops`).subscribe({
      next: (data) => {
        // ใช้ .map ดึงมาเฉพาะรหัสคอก (เผื่อหลังบ้านส่งชื่อฟิลด์มาเป็น id เฉยๆ เลยใส่ดักไว้ให้ด้วยครับ)
        this.coops = data.map(item => {
          return { coop_id: item.coop_id || item.id }; 
        });
        
        console.log('ดึงเฉพาะเลขคอกสำเร็จ:', this.coops);
        
        // 3. บังคับให้ Angular อัปเดตหน้าจอเดี๋ยวนี้! 
        this.cdr.detectChanges(); 
      },
      error: (err) => {
        console.error('ดึงข้อมูลล้มเหลว:', err);
      }
    });
  }

  selectCoop(coop: Coop) {
    const finalNumber = coop.coop_id ? coop.coop_id.toString() : '';
    console.log('เลือกคอกไก่ที่:', finalNumber);
    this.router.navigate(['/setup'], { queryParams: { coop: finalNumber } }); 
  }
}