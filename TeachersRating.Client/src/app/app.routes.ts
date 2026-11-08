import { Routes } from '@angular/router';
import { adminGuard } from './services/admin/admin.service';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  {
    path: 'home',
    title: 'ЮніКраш — знайди свого краш-викладача',
    loadComponent: () => import('./components/selection-form/selection-form.component').then(m => m.SelectionFormComponent),
  },
  {
    path: 'comparison/:departmentId',
    title: 'Свайп · ЮніКраш',
    loadComponent: () => import('./components/swipe-comparison/swipe-comparison.component').then(m => m.SwipeComparisonComponent),
  },
  {
    path: 'leaderboard',
    title: 'Рейтинг · ЮніКраш',
    loadComponent: () => import('./components/leaderboard/leaderboard').then(m => m.Leaderboard),
  },
  {
    path: 'teacher/:id',
    title: 'Профіль викладача · ЮніКраш',
    loadComponent: () => import('./components/teacher-profile/teacher-profile').then(m => m.TeacherProfile),
  },
  // The old per-department top is now part of the leaderboard (filter by department).
  { path: 'top-workers', redirectTo: '/leaderboard' },
  {
    path: 'admin/login',
    title: 'Вхід · Адмінка ЮніКраш',
    loadComponent: () => import('./components/admin/admin-login/admin-login').then(m => m.AdminLogin),
  },
  {
    path: 'admin',
    title: 'Дашборд · Адмінка ЮніКраш',
    canActivate: [adminGuard],
    loadComponent: () => import('./components/admin/admin-dashboard/admin-dashboard').then(m => m.AdminDashboard),
  },
  // The old hidden stats page is now the admin dashboard.
  { path: 'users-stats-secret', redirectTo: '/admin' },
  { path: '**', redirectTo: '/home' },
];
