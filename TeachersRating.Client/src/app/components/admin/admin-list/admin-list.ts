import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { fmt } from '../admin-format';

export interface AdminListRow {
  label: string;
  icon?: string;
  sub?: string | null;
  value: number;
  /** Optional second number (e.g. page views, dislikes). */
  value2?: number | null;
  link?: (string | number)[] | null;
}

/** Ranked list with proportional bars — used for every breakdown on the dashboard. */
@Component({
  selector: 'app-admin-list',
  imports: [RouterLink],
  template: `
    <section class="panel card">
      <header class="panel-head">
        <h3>{{ title() }}</h3>
        @if (valueLabel()) {
          <span class="panel-cols">{{ valueLabel() }}@if (value2Label()) { <span> · {{ value2Label() }}</span> }</span>
        }
      </header>

      @if (rows().length === 0) {
        <p class="panel-empty">Немає даних за період</p>
      } @else {
        <ol class="list-rows">
          @for (row of visible(); track $index) {
            <li class="list-row">
              <span class="bar" [style.--w.%]="width(row.value)"></span>
              <span class="row-label">
                @if (row.icon) { <span class="row-icon">{{ row.icon }}</span> }
                @if (row.link) {
                  <a [routerLink]="row.link" class="row-link">{{ row.label }}</a>
                } @else {
                  <span>{{ row.label }}</span>
                }
                @if (row.sub) { <small>{{ row.sub }}</small> }
              </span>
              <span class="row-values">
                <b>{{ fmt(row.value) }}</b>
                @if (row.value2 !== undefined && row.value2 !== null) { <span>{{ fmt(row.value2) }}</span> }
              </span>
            </li>
          }
        </ol>
        @if (rows().length > limit()) {
          <button type="button" class="link-btn more" (click)="expanded.set(!expanded())">
            {{ expanded() ? 'Згорнути' : 'Показати всі (' + rows().length + ')' }}
          </button>
        }
      }
    </section>
  `,
})
export class AdminList {
  readonly title = input.required<string>();
  readonly rows = input<AdminListRow[]>([]);
  readonly valueLabel = input<string>('');
  readonly value2Label = input<string>('');
  readonly limit = input<number>(8);

  readonly expanded = signal(false);
  readonly fmt = fmt;

  readonly max = computed(() => Math.max(1, ...this.rows().map(r => r.value)));
  readonly visible = computed(() => (this.expanded() ? this.rows() : this.rows().slice(0, this.limit())));

  width(value: number): number {
    return Math.max(2, Math.round((value / this.max()) * 100));
  }
}
