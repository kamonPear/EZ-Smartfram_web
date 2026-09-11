import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Subscription, interval } from 'rxjs';
import { Device, EggRecord, HealthRecord, VaccineRecord, formatThaiDate } from '../../shared/coop-summary.util';

@Component({
  selector: 'app-data-coop',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './Data_coop.html',
  styleUrls: ['./Data_coop.scss']
})
export class DataCoopComponent implements OnInit, OnDestroy {

  selectedCoop: string | null = null;
  selectedCoopName: string | null = null;
  isLoading: boolean = false;

  formatThaiDate = formatThaiDate;

  chickenCount: number | null = null;
  birthDate: Date | null = null;
  receivedDate: Date | null = null;
  note: string = '';

  devicesList: Device[] = [];
  healthRecords: HealthRecord[] = [];
  vaccineRecords: VaccineRecord[] = [];
  eggRecords: EggRecord[] = [];

  private refreshSubscription!: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const state = history.state;
    if (state && state.coopNumber) {
      this.selectedCoop = state.coopNumber;
    }

    this.route.queryParams.subscribe(params => {
      if (params['coop']) {
        this.selectedCoop = params['coop'];
      }

      if (this.selectedCoop) {
        this.fetchCoopDetails();
        this.startAutoRefresh();
      } else {
        console.warn('No selectedCoop. API fetch aborted.');
      }
    });
  }

  ngOnDestroy() {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  private applyCoopDetails(data: any) {
    if (data?.name_coop) {
      this.selectedCoopName = data.name_coop;
    }
    this.chickenCount = data?.amount ?? null;
    this.birthDate = data?.birthday ? new Date(data.birthday) : null;
    this.receivedDate = data?.date_adopt_animals ? new Date(data.date_adopt_animals) : null;
    this.note = data?.note || '';
    this.devicesList = data?.devices || [];
    this.healthRecords = data?.health || [];
    this.vaccineRecords = data?.vaccines || [];
    this.eggRecords = data?.eggs || [];
  }

  fetchCoopDetails(silent = false) {
    if (!this.selectedCoop) return;
    if (!silent) this.isLoading = true;

    this.api.get<any>(`/coops?id=${this.selectedCoop}`).subscribe({
      next: (data) => {
        this.applyCoopDetails(data);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('ดึงข้อมูลคอกล้มเหลว:', err);
      }
    });
  }

  startAutoRefresh() {
    if (!this.refreshSubscription) {
      this.refreshSubscription = interval(5000).subscribe(() => {
        this.fetchCoopDetails(true);
      });
    }
  }

  formatDate(date: Date | null): string {
    if (!date) return '-';
    return date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  get deviceOnlineCount(): number {
    return this.devicesList.filter(d => d.current_status === 'Online').length;
  }

  goToDeviceStatus() {
    this.router.navigate(['/device-status'], { queryParams: { coop: this.selectedCoop } });
  }
}
