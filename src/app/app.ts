import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { GlobalSearchComponent } from './components/global-search/global-search.component';

// หน้าที่วางช่องค้นหารวมไว้ในหน้าเองแล้ว (ไม่ต้องมีปุ่มแว่นขยายลอยซ้ำ) และหน้า login
const PAGES_WITH_SEARCH_BOX = [
  '/login', '/home', '/search', '/coop-list', '/notifications',
  '/device-summary', '/health-appointments', '/food', '/add-vaccine',
];

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, SidebarComponent, GlobalSearchComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('EzsmartFrameweb');

  // ซ่อน sidebar/hamburger ตอนอยู่หน้า login เพราะยังไม่ได้ล็อกอิน ไม่ควรเห็นเมนู
  // ของแอปที่ต้องล็อกอินก่อนถึงจะใช้ได้
  protected readonly showChrome = signal(true);

  // ปุ่มแว่นขยายค้นหารวมลอยมุมขวาบน ขึ้นเฉพาะหน้าที่ไม่มีช่องค้นหารวมอยู่ในหน้าเอง
  protected readonly showGlobalSearch = signal(true);

  constructor(private router: Router) {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        const url = e.urlAfterRedirects;
        this.showChrome.set(!url.startsWith('/login'));
        const hasOwnSearch = url === '/' || PAGES_WITH_SEARCH_BOX.some((prefix) => url.startsWith(prefix));
        this.showGlobalSearch.set(!hasOwnSearch);
      });
  }
}
