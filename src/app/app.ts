import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { SidebarComponent } from './components/sidebar/sidebar.component';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, SidebarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('EzsmartFrameweb');

  // ซ่อน sidebar/hamburger ตอนอยู่หน้า login เพราะยังไม่ได้ล็อกอิน ไม่ควรเห็นเมนู
  // ของแอปที่ต้องล็อกอินก่อนถึงจะใช้ได้
  protected readonly showChrome = signal(true);

  constructor(private router: Router) {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.showChrome.set(!e.urlAfterRedirects.startsWith('/login'));
      });
  }
}
