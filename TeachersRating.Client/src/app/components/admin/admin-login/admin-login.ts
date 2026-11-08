import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { AdminService } from '../../../services/admin/admin.service';

@Component({
  selector: 'app-admin-login',
  imports: [FontAwesomeModule],
  template: `
    <div class="login">
      <form class="login-card card" (submit)="submit($event, user.value, pass.value)">
        <span class="login-icon"><fa-icon icon="lock"></fa-icon></span>
        <h1 class="login-title">Адмінка</h1>
        <p class="muted login-sub">Вхід лише для адміністратора ЮніКраш.</p>

        @if (error()) { <div class="login-error" role="alert">{{ error() }}</div> }

        <div class="field">
          <label for="admin-user">Логін</label>
          <input #user id="admin-user" class="input" autocomplete="username" required autofocus />
        </div>
        <div class="field">
          <label for="admin-pass">Пароль</label>
          <input #pass id="admin-pass" class="input" type="password" autocomplete="current-password" required />
        </div>

        <button class="btn btn-primary btn-block" type="submit" [disabled]="busy()">
          @if (busy()) { <span class="spinner light"></span> } @else { Увійти }
        </button>
      </form>
    </div>
  `,
})
export class AdminLogin {
  private admin = inject(AdminService);
  private router = inject(Router);

  readonly busy = signal(false);
  readonly error = signal('');

  submit(event: Event, username: string, password: string) {
    event.preventDefault();
    if (!username || !password || this.busy()) return;

    this.busy.set(true);
    this.error.set('');
    this.admin.login(username, password).subscribe({
      next: () => this.router.navigate(['/admin']),
      error: (err) => {
        this.busy.set(false);
        this.error.set(err?.status === 429
          ? 'Забагато спроб. Зачекай кілька хвилин.'
          : 'Невірний логін або пароль.');
      },
    });
  }
}
