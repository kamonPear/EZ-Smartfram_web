import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { formatDateKey } from '../shared/calendar-markers.util';

// นัดตรวจสุขภาพที่กำหนดวันเอง (หน้า "นัดตรวจสุขภาพ" โหมด "นัดตรวจสุขภาพเอง") -
// ย้ายจาก localStorage (เฉพาะเครื่อง/เบราว์เซอร์เดียว) มาเก็บที่ฝั่ง backend แล้ว
// เพื่อให้เว็บและแอปมือถือเห็นนัดเดียวกัน และ /api/calendar/markers เอาไปรวมกับ
// วัคซีน/สุขภาพ/วันเกิดของคอกเป็นปฏิทินเดียวกันได้
export interface HealthAppointment {
  appointment_id: number;
  coop_id: number;
  appointment_date: string; // ISO
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class HealthAppointmentService {
  constructor(private api: ApiService) {}

  list(coopId?: number | null): Observable<HealthAppointment[]> {
    const query = coopId != null ? `?coop_id=${coopId}` : '';
    return this.api.get<HealthAppointment[]>(`/health-appointments${query}`);
  }

  create(coopId: number, date: Date): Observable<HealthAppointment> {
    return this.api.post<HealthAppointment>('/health-appointments', {
      coop_id: coopId,
      appointment_date: `${formatDateKey(date)}T00:00:00Z`,
    });
  }

  remove(appointmentId: number): Observable<unknown> {
    return this.api.delete(`/health-appointments?id=${appointmentId}`);
  }
}
