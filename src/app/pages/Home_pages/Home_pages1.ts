import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';

interface Coop {
  coop_id: number;
  name_coop: string;
  amount: number;
}

@Component({
  selector: 'app-home-pages1',
  standalone: true,
  imports: [CommonModule, RouterModule],

  templateUrl: './Home_pages1.html', // ต้องมี ./ และชื่อไฟล์ต้องตรงเป๊ะ
  styleUrls: ['./Home_pages1.scss']
})
export class HomePages1 implements OnInit {

  coops: Coop[] = [];

  isDeleteModalOpen = false;
  coopToDelete: Coop | null = null;
  isDeleting = false;

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
    this.router.navigate(['/system-sensor'], {
      state: { coopNumber: coop.coop_id?.toString() }
    });
  }

  requestDeleteCoop(event: Event, coop: Coop) {
    event.stopPropagation();
    this.coopToDelete = coop;
    this.isDeleteModalOpen = true;
  }

  cancelDeleteCoop() {
    this.coopToDelete = null;
    this.isDeleteModalOpen = false;
  }

  confirmDeleteCoop() {
    if (!this.coopToDelete) return;
    const coopId = this.coopToDelete.coop_id;

    this.isDeleting = true;
    this.api.delete<any>(`/coops?id=${coopId}`).subscribe({
      next: () => {
        this.isDeleting = false;
        this.coops = this.coops.filter(c => c.coop_id !== coopId);
        this.isDeleteModalOpen = false;
        this.coopToDelete = null;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isDeleting = false;
        console.error('ลบคอกไม่สำเร็จ:', err);
        alert('ลบคอกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        this.cdr.detectChanges();
      }
    });
  }

  openTemperatureSettings() {
  }
}
