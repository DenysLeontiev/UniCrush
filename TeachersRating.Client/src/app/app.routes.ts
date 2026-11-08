import { Routes } from '@angular/router';

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
    path: 'users-stats-secret',
    title: 'Статистика · ЮніКраш',
    loadComponent: () => import('./components/users-stats/users-stats').then(m => m.UsersStatsComponent),
  },
  { path: '**', redirectTo: '/home' },
];
