import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ThemeService } from '../../services/theme.service';

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
export class SidebarComponent implements OnInit {
  isOpen = signal(false);

  constructor(private location: Location, private themeService: ThemeService) {}

  ngOnInit(): void {
    this.themeService.load();
  }

  isDarkTheme() {
    return this.themeService.isDark();
  }

  toggleTheme() {
    this.themeService.toggle();
  }

  menuItems: MenuItem[] = [
    { label: 'หน้าหลัก',                  icon: 'assets/images/logo.png',    route: '/home' },
    { label: 'เพิ่มคอกไก่',               icon: 'assets/images/chicken.png', route: '/add-coop' },
    { label: 'จัดวางผังฟาร์ม',            icon: 'assets/images/coopchicken.png', route: '/farm-layout' },
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

  goBack() {
    this.location.back();
  }
}
