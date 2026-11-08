import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { AdminService } from '../../../services/admin/admin.service';
import { ToastService } from '../../../services/toast/toast.service';
import { AdminComment } from '../../../models/admin.model';
import { TimeAgoPipe } from '../../../pipes/time-ago/time-ago.pipe';

type Status = 'all' | 'visible' | 'hidden';

/** Latest comments with hide / restore / delete. */
@Component({
  selector: 'app-admin-moderation',
  imports: [FontAwesomeModule, RouterLink, TimeAgoPipe],
  template: `
    <section class="panel card moderation">
      <header class="panel-head">
        <h3>Модерація коментарів</h3>
        <span class="panel-cols">{{ total() }} шт.</span>
      </header>

      <div class="mod-toolbar">
        <div class="mod-search">
          <fa-icon icon="magnifying-glass"></fa-icon>
          <input #q type="search" class="input" placeholder="Текст, ім’я або викладач" (input)="onSearch(q.value)" />
        </div>
        <div class="mod-status">
          @for (s of statuses; track s.value) {
            <button type="button" class="chip" [class.active]="status() === s.value" (click)="setStatus(s.value)">{{ s.label }}</button>
          }
        </div>
      </div>

      @if (loading() && items().length === 0) {
        <div class="mod-loading"><span class="spinner"></span></div>
      } @else if (items().length === 0) {
        <p class="panel-empty">Коментарів не знайдено</p>
      } @else {
        <ul class="mod-list">
          @for (c of items(); track c.id) {
            <li class="mod-item" [class.hidden-item]="c.isHidden">
              <div class="mod-meta">
                <a class="mod-teacher" [routerLink]="['/teacher', c.workerId]">{{ c.workerName }}</a>
                <span>·</span>
                <span>{{ c.authorName || 'Анонім' }}</span>
                <span>·</span>
                <span [title]="c.dateCreated">{{ c.dateCreated | timeAgo }}</span>
                @if (c.isHidden) { <span class="tag hidden-tag">приховано</span> }
                @if (c.repliesCount > 0) { <span class="tag">{{ c.repliesCount }} відп.</span> }
              </div>
              @if (c.parentContent) {
                <p class="mod-parent"><fa-icon icon="reply"></fa-icon> {{ c.parentContent }}</p>
              }
              <p class="mod-content">{{ c.content }}</p>
              <div class="mod-actions">
                @if (c.isHidden) {
                  <button type="button" class="btn btn-sm btn-soft" (click)="restore(c)"><fa-icon icon="eye"></fa-icon> Показати</button>
                } @else {
                  <button type="button" class="btn btn-sm" (click)="hide(c)"><fa-icon icon="eye-slash"></fa-icon> Приховати</button>
                }
                <button type="button" class="btn btn-sm btn-ghost danger" (click)="remove(c)"><fa-icon icon="trash"></fa-icon> Видалити</button>
              </div>
            </li>
          }
        </ul>

        <div class="mod-pager">
          <button type="button" class="btn btn-sm" [disabled]="page() <= 1" (click)="go(page() - 1)">← Новіші</button>
          <span class="muted">{{ page() }} / {{ totalPages() || 1 }}</span>
          <button type="button" class="btn btn-sm" [disabled]="page() >= totalPages()" (click)="go(page() + 1)">Старіші →</button>
        </div>
      }
    </section>
  `,
})
export class AdminModeration {
  private admin = inject(AdminService);
  private toast = inject(ToastService);

  readonly statuses: { value: Status; label: string }[] = [
    { value: 'all', label: 'Усі' },
    { value: 'visible', label: 'Видимі' },
    { value: 'hidden', label: 'Приховані' },
  ];

  readonly items = signal<AdminComment[]>([]);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly page = signal(1);
  readonly status = signal<Status>('all');
  readonly loading = signal(true);

  private search = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.admin.comments({ search: this.search, status: this.status(), pageNumber: this.page(), pageSize: 15 }).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.total.set(res.totalCount);
        this.totalPages.set(res.totalPages);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onSearch(value: string) {
    this.search = value.trim();
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.go(1), 300);
  }

  setStatus(status: Status) {
    this.status.set(status);
    this.go(1);
  }

  go(page: number) {
    this.page.set(page);
    this.load();
  }

  hide(c: AdminComment) {
    this.admin.hideComment(c.id).subscribe(() => {
      this.toast.show('Коментар приховано');
      this.load();
    });
  }

  restore(c: AdminComment) {
    this.admin.restoreComment(c.id).subscribe(() => {
      this.toast.show('Коментар знову видно');
      this.load();
    });
  }

  remove(c: AdminComment) {
    const replies = c.repliesCount > 0 ? ` разом з ${c.repliesCount} відповідями` : '';
    if (!confirm(`Видалити коментар назавжди${replies}? Це не можна скасувати.`)) return;
    this.admin.deleteComment(c.id).subscribe(() => {
      this.toast.show('Коментар видалено');
      this.load();
    });
  }
}
