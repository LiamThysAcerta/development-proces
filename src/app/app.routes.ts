import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard';
import { GuideComponent } from './components/guide/guide';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'guide', component: GuideComponent },
  { path: '**', redirectTo: 'dashboard' },
];
