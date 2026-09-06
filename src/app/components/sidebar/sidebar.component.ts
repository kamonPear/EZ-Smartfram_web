import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface MenuItem {
  label: string;
  icon: string;
  route?: string;
  action?: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
  isOpen = signal(false);

  menuItems: MenuItem[] = [
    { label: 'หน้าหลัก',                  icon: 'assets/images/logo.png',    route: '/home' },
    { label: 'เพิ่มคอกไก่',               icon: 'assets/images/chicken.png', route: '/add-coop' },
    { label: 'เพิ่มอุปกรณ์',              icon: 'assets/images/esp32.png',   route: '/arrange' },
    { label: 'เพิ่มข้อมูลยาวัคซีน',       icon: 'assets/images/Vaccine.png', route: '/add-vaccine' },
    { label: 'เพิ่มข้อมูลไข่ไก่',         icon: 'assets/images/egg.png',     route: '/add-egg' },
    { label: 'ตั้งค่าอุณหภูมิ',           icon: 'assets/images/temp.png',    route: '/setup' },
    { label: 'สถานะการทำงานของอุปกรณ์',   icon: 'assets/images/esp32.png',   route: '/chicken-sensor' },
  ];

  toggle() {
    this.isOpen.update(v => !v);
  }

  close() {
    this.isOpen.set(false);
  }
}
