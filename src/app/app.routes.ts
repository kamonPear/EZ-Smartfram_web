import { Routes } from '@angular/router';
// Import หน้าแรก (Home)
import { HomePages1 } from './pages/Home_pages/Home_pages1';
// Import หน้าจัดวาง (Arrange)
import { ArrangeEquipmentComponent } from './pages/Arrange_equipment/Arrange_equipment';
import { SetUpSystem } from './pages/Set_up_System/Set_up_System';
import { ChickensensorSystemComponent } from './pages/Chicken_sensor_System/Chicken_sensor_System';
import { SystemSensorComponent } from './pages/System_sensor/System_sensor';
import { AddCoopComponent } from './pages/Add_coop/Add_coop';
import { EditCoopComponent } from './pages/Edit_coop/Edit_coop';
import { AddVaccineComponent } from './pages/Add_vaccine/Add_vaccine';
import { AddEggComponent } from './pages/Add_egg/Add_egg';
import { FarmLayoutComponent } from './pages/Farm_layout/Farm_layout';

export const routes: Routes = [
  // ถ้าเปิดหน้าเว็บมาครั้งแรก (Path ว่าง) ให้สั่ง Redirect ไปที่หน้า home
  { path: '', redirectTo: 'home', pathMatch: 'full' },

  { path: 'home', component: HomePages1 },

  { path: 'add-coop', component: AddCoopComponent },

  { path: 'edit-coop', component: EditCoopComponent },

  { path: 'add-vaccine', component: AddVaccineComponent },

  { path: 'add-egg', component: AddEggComponent },

  // ถ้าคลิกมาที่ /arrange ให้ไปที่หน้าจัดวางอุปกรณ์
  { path: 'arrange', component: ArrangeEquipmentComponent },

  { path: 'farm-layout', component: FarmLayoutComponent },

  { path: 'setup', component: SetUpSystem },

  { path: 'chicken-sensor', component: ChickensensorSystemComponent },

  { path: 'system-sensor', component: SystemSensorComponent }
];