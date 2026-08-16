import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-home-pages1',
  standalone: true,
  imports: [RouterModule],

  templateUrl: './Home_pages1.html', // ต้องมี ./ และชื่อไฟล์ต้องตรงเป๊ะ
  styleUrls: ['./Home_pages1.scss']
})
export class HomePages1 {

  openTemperatureSettings() {
  }
}
