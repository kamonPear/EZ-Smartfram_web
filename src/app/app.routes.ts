import { Routes } from '@angular/router';
// Import หน้าแรก (Home)
import { HomePages1 } from './pages/Home_pages/Home_pages1';
// Import หน้าจัดวาง (Arrange)
import { ArrangeEquipmentComponent } from './pages/Arrange_equipment/Arrange_equipment';
import { SetUpSystem } from './pages/Set_up_System/Set_up_System';
import { ChickensensorSystemComponent } from './pages/Chicken_sensor_System/Chicken_sensor_System';
import { DataCoopComponent } from './pages/Data_coop/Data_coop';
import { AddCoopComponent } from './pages/Add_coop/Add_coop';
import { EditCoopComponent } from './pages/Edit_coop/Edit_coop';
import { AddVaccineComponent } from './pages/Add_vaccine/Add_vaccine';
import { AddEggComponent } from './pages/Add_egg/Add_egg';
import { FarmLayoutComponent } from './pages/Farm_layout/Farm_layout';
import { DeviceStatusComponent } from './pages/Device_status/Device_status';
import { FarmThresholdsComponent } from './pages/Farm_thresholds/Farm_thresholds';
import { AddHealthComponent } from './pages/Add_health/Add_health';
import { DeviceSummaryComponent } from './pages/Device_summary/Device_summary';
import { NotificationsComponent } from './pages/Notifications/Notifications';
import { HealthAppointmentsComponent } from './pages/Health_appointments/Health_appointments';
import { GiveVaccineComponent } from './pages/Give_vaccine/Give_vaccine';
import { LoginComponent } from './pages/Login/Login';
import { authGuard } from './services/auth.guard';

export const routes: Routes = [
  // หน้าล็อกอิน - จุดเดียวที่ไม่ต้องผ่าน authGuard (ต้องเข้าได้ก่อนล็อกอินเสมอ)
  { path: 'login', component: LoginComponent },

  // ทุกหน้าที่เหลือ ต้องล็อกอินก่อนถึงเข้าได้ - ครอบด้วย parent path ว่างที่ผูก
  // authGuard ไว้ (ถ้ายังไม่ล็อกอิน guard จะเด้งไป /login เอง) แทนที่จะแปะ
  // canActivate ซ้ำทุก route ด้านล่าง
  {
    path: '',
    canActivate: [authGuard],
    children: [
      // ถ้าเปิดหน้าเว็บมาครั้งแรก (Path ว่าง) ให้สั่ง Redirect ไปที่หน้า home
      { path: '', redirectTo: 'home', pathMatch: 'full' },

      { path: 'home', component: HomePages1 },

      { path: 'add-coop', component: AddCoopComponent },

      { path: 'edit-coop', component: EditCoopComponent },

      { path: 'add-vaccine', component: AddVaccineComponent },

      { path: 'add-egg', component: AddEggComponent },

      { path: 'add-health', component: AddHealthComponent },

      // ถ้าคลิกมาที่ /arrange ให้ไปที่หน้าจัดวางอุปกรณ์
      { path: 'arrange', component: ArrangeEquipmentComponent },

      { path: 'farm-layout', component: FarmLayoutComponent },

      { path: 'setup', component: SetUpSystem },

      { path: 'farm-thresholds', component: FarmThresholdsComponent },

      { path: 'chicken-sensor', component: ChickensensorSystemComponent },

      { path: 'device-summary', component: DeviceSummaryComponent },

      { path: 'notifications', component: NotificationsComponent },

      { path: 'health-appointments', component: HealthAppointmentsComponent },

      { path: 'give-vaccine', component: GiveVaccineComponent },

      { path: 'data-coop', component: DataCoopComponent },

      { path: 'device-status', component: DeviceStatusComponent }
    ]
  }
];