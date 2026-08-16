import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { HttpClientModule } from '@angular/common/http';

// เติม /api ไว้ที่นี่ที่เดียวเลยครับ
export const API_BASE_URL = 'https://ez-smartfarm-backn.onrender.com/api';

export const appConfig: ApplicationConfig = {
  providers: [
    importProvidersFrom(HttpClientModule),
    provideRouter(routes)
  ]
};