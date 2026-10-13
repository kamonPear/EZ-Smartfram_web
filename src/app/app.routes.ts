import { Routes } from '@angular/router';
// Import หน้าแรก (Home)
import { HomePages1 } from './pages/Home_pages/Home_pages1';
// Import หน้าจัดวาง (Arrange)
import { LoginComponent } from './pages/Login/Login';
import { authGuard } from './services/auth.guard';

// หน้าอื่นนอกจาก login/หน้าแรกโหลดแบบ lazy (แยกไฟล์ ดึงเมื่อเปิดหน้านั้น) ให้ไฟล์หลักเล็ก เปิดเว็บเร็ว และ
// production build ไม่ชนงบขนาดไฟล์ (initial bundle ≤ 1MB) เมื่อเพิ่มฟีเจอร์
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

      { path: 'add-coop', loadComponent: () => import('./pages/Add_coop/Add_coop').then((m) => m.AddCoopComponent) },

      { path: 'edit-coop', loadComponent: () => import('./pages/Edit_coop/Edit_coop').then((m) => m.EditCoopComponent) },

      { path: 'add-vaccine', loadComponent: () => import('./pages/Add_vaccine/Add_vaccine').then((m) => m.AddVaccineComponent) },

      { path: 'add-egg', loadComponent: () => import('./pages/Add_egg/Add_egg').then((m) => m.AddEggComponent) },

      { path: 'add-health', loadComponent: () => import('./pages/Add_health/Add_health').then((m) => m.AddHealthComponent) },

      // ถ้าคลิกมาที่ /arrange ให้ไปที่หน้าจัดวางอุปกรณ์
      { path: 'arrange', loadComponent: () => import('./pages/Arrange_equipment/Arrange_equipment').then((m) => m.ArrangeEquipmentComponent) },

      { path: 'farm-layout', loadComponent: () => import('./pages/Farm_layout/Farm_layout').then((m) => m.FarmLayoutComponent) },

      { path: 'setup', loadComponent: () => import('./pages/Set_up_System/Set_up_System').then((m) => m.SetUpSystem) },

      { path: 'add-device-type', loadComponent: () => import('./pages/Add_device_type/Add_device_type').then((m) => m.AddDeviceTypeComponent) },

      { path: 'farm-thresholds', loadComponent: () => import('./pages/Farm_thresholds/Farm_thresholds').then((m) => m.FarmThresholdsComponent) },

      { path: 'chicken-sensor', loadComponent: () => import('./pages/Chicken_sensor_System/Chicken_sensor_System').then((m) => m.ChickensensorSystemComponent) },

      { path: 'device-summary', loadComponent: () => import('./pages/Device_summary/Device_summary').then((m) => m.DeviceSummaryComponent) },

      // โหลดแบบ lazy (แยกไฟล์ ดึงเมื่อเปิดหน้านั้นเท่านั้น) - หน้า Backup มีตัวสร้างไฟล์ SQL/Excel/PDF ที่ใหญ่
      // ไม่ควรรวมอยู่ในไฟล์หลักที่ทุกคนต้องโหลดตั้งแต่เปิดเว็บ (ไฟล์หลักเกินงบ 1MB ของ production build)
      { path: 'search', loadComponent: () => import('./pages/Search/Search').then((m) => m.SearchPageComponent) },

      { path: 'backup', loadComponent: () => import('./pages/Backup/Backup').then((m) => m.BackupPageComponent) },

      { path: 'notifications', loadComponent: () => import('./pages/Notifications/Notifications').then((m) => m.NotificationsComponent) },

      { path: 'health-appointments', loadComponent: () => import('./pages/Health_appointments/Health_appointments').then((m) => m.HealthAppointmentsComponent) },

      { path: 'give-vaccine', loadComponent: () => import('./pages/Give_vaccine/Give_vaccine').then((m) => m.GiveVaccineComponent) },

      { path: 'data-coop', loadComponent: () => import('./pages/Data_coop/Data_coop').then((m) => m.DataCoopComponent) },

      // หน้ารวมคอกไก่ทั้งหมด - การ์ดสถิติ "คอกทั้งหมด"/"ไก่ทั้งหมด" ที่หน้าแรกกด
      // มาที่นี่ เป็นลิสต์เต็มจอแทนที่จะแค่เลื่อนจอลงไปหาส่วนท้ายของหน้าแรก
      { path: 'coop-list', loadComponent: () => import('./pages/Coop_list/Coop_list').then((m) => m.CoopListComponent) },

      { path: 'device-status', loadComponent: () => import('./pages/Device_status/Device_status').then((m) => m.DeviceStatusComponent) },

      // คลังอาหาร - ย้ายมาจากแอปมือถือ ให้เว็บมีฟีเจอร์นี้ด้วย (backend ชุดเดียวกัน
      // อยู่แล้ว ข้อมูลจึงตรงกันทั้งเว็บและแอป)
      { path: 'food', loadComponent: () => import('./pages/Food/Food').then((m) => m.FoodComponent) },
      { path: 'add-food', loadComponent: () => import('./pages/Add_food/Add_food').then((m) => m.AddFoodComponent) },
      { path: 'food-type-summary', loadComponent: () => import('./pages/Food_type_summary/Food_type_summary').then((m) => m.FoodTypeSummaryComponent) }
    ]
  }
];