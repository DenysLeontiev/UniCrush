import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import type { ApexOptions } from 'apexcharts';
import { AdminService } from '../../../services/admin/admin.service';
import { PresenceService } from '../../../services/presence/presence.service';
import { ThemeService } from '../../../services/theme/theme.service';
import {
  BreakdownRow, CountRow, DashboardBreakdowns, DashboardEngagement, DashboardOverview, DashboardTimeseries, LiveSnapshot,
} from '../../../models/admin.model';
import { TimeAgoPipe } from '../../../pipes/time-ago/time-ago.pipe';
import { AdminList, AdminListRow } from '../admin-list/admin-list';
import { AdminChart } from '../admin-chart/admin-chart';
import { AdminModeration } from '../admin-moderation/admin-moderation';
import {
  addDays, countryName, delta, deviceName, duration, flag, fmt, pageName, pct, shortDate, toIsoDate,
} from '../admin-format';

type Preset = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'month' | 'all' | 'custom';

interface Kpi {
  label: string;
  value: string;
  hint?: string;
  delta?: { text: string; tone: 'up' | 'down' | 'flat' };
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const REFERRER_NAMES: Record<string, string> = {
  direct: 'Прямі заходи / закладки', telegram: 'Telegram', instagram: 'Instagram', facebook: 'Facebook', 'x.com': 'X (Twitter)', google: 'Google',
};
const THEME_NAMES: Record<string, string> = { light: 'Світла', dark: 'Темна', unknown: 'Невідомо' };
const SHARE_NAMES: Record<string, string> = { native: 'Системне «Поділитися»', copy: 'Копіювання посилання', telegram: 'Telegram' };

@Component({
  selector: 'app-admin-dashboard',
  imports: [FontAwesomeModule, TimeAgoPipe, AdminList, AdminModeration, AdminChart],
  templateUrl: './admin-dashboard.html',
})
export class AdminDashboard implements OnInit, OnDestroy {
  readonly admin = inject(AdminService);
  private presence = inject(PresenceService);
  private theme = inject(ThemeService);
  private router = inject(Router);

  readonly presets: { value: Preset; label: string }[] = [
    { value: 'today', label: 'Сьогодні' },
    { value: 'yesterday', label: 'Вчора' },
    { value: '7d', label: '7 днів' },
    { value: '30d', label: '30 днів' },
    { value: '90d', label: '90 днів' },
    { value: 'month', label: 'Цей місяць' },
    { value: 'all', label: 'Увесь час' },
  ];

  readonly today = toIsoDate(new Date());
  readonly preset = signal<Preset>('7d');
  readonly from = signal(addDays(this.today, -6));
  readonly to = signal(this.today);

  readonly overview = signal<DashboardOverview | null>(null);
  readonly series = signal<DashboardTimeseries | null>(null);
  readonly breakdowns = signal<DashboardBreakdowns | null>(null);
  readonly engagement = signal<DashboardEngagement | null>(null);
  readonly loading = signal(true);
  readonly lastUpdated = signal<Date | null>(null);

  private readonly liveFromHub = toSignal(this.presence.snapshot$, { initialValue: null });
  private readonly liveInitial = signal<LiveSnapshot | null>(null);
  readonly live = computed(() => this.liveFromHub() ?? this.liveInitial());

  readonly fmt = fmt;
  readonly flag = flag;
  readonly countryName = countryName;
  readonly pageName = pageName;
  readonly deviceName = deviceName;
  readonly weekdays = WEEKDAYS;
  readonly hours = Array.from({ length: 24 }, (_, i) => i);

  private refreshTimer?: ReturnType<typeof setInterval>;

  // ---------- KPIs ----------

  readonly kpis = computed<Kpi[]>(() => {
    const o = this.overview();
    if (!o) return [];
    const c = o.current, p = o.previous;
    const returning = (s: typeof c) => Math.max(0, s.visitors - s.newVisitors);

    return [
      { label: 'Відвідувачі', value: fmt(c.visitors), hint: 'Унікальні браузери', delta: delta(c.visitors, p.visitors) },
      { label: 'Нові', value: fmt(c.newVisitors), hint: 'Вперше на сайті', delta: delta(c.newVisitors, p.newVisitors) },
      { label: 'Повернулись', value: fmt(returning(c)), hint: 'Були раніше', delta: delta(returning(c), returning(p)) },
      { label: 'Сесії', value: fmt(c.sessions), hint: 'Візити (30 хв неактивності = нова)', delta: delta(c.sessions, p.sessions) },
      { label: 'Перегляди', value: fmt(c.pageviews), hint: 'Відкриті сторінки', delta: delta(c.pageviews, p.pageviews) },
      { label: 'Сер. сесія', value: duration(c.avgSessionSeconds), hint: 'Від першої до останньої дії', delta: delta(c.avgSessionSeconds, p.avgSessionSeconds) },
      { label: 'Сторінок / сесію', value: fmt(c.pagesPerSession, 1), delta: delta(c.pagesPerSession, p.pagesPerSession) },
      { label: 'Відмови', value: pct(c.bounceRate, 1), hint: 'Сесії з 1 переглядом', delta: delta(c.bounceRate, p.bounceRate, true) },
      { label: 'Лайки', value: fmt(c.likes), delta: delta(c.likes, p.likes) },
      { label: 'Дизлайки', value: fmt(c.dislikes), delta: delta(c.dislikes, p.dislikes) },
      { label: 'Коментарі', value: fmt(c.comments), delta: delta(c.comments, p.comments) },
      { label: 'Пошуки', value: fmt(c.searches), delta: delta(c.searches, p.searches) },
      { label: 'Поширення', value: fmt(c.shares), delta: delta(c.shares, p.shares) },
      { label: 'Пік онлайн', value: fmt(c.peakOnline), hint: 'Максимум одночасно', delta: delta(c.peakOnline, p.peakOnline) },
    ];
  });

  readonly activeCards = computed(() => {
    const o = this.overview();
    if (!o) return [];
    const stickiness = o.active.mau ? Math.round((o.active.dau / o.active.mau) * 100) : 0;
    return [
      { label: 'DAU', value: fmt(o.active.dau), hint: `Активні за ${shortDate(o.range.to)}` },
      { label: 'WAU', value: fmt(o.active.wau), hint: '7 днів до кінця періоду' },
      { label: 'MAU', value: fmt(o.active.mau), hint: '30 днів до кінця періоду' },
      { label: 'Stickiness', value: `${stickiness}%`, hint: 'DAU / MAU' },
      { label: 'Сер. DAU', value: fmt(o.avgDau, 1), hint: 'Середнє за день у періоді' },
      { label: 'Усього відвідувачів', value: fmt(o.totals.visitors), hint: 'За весь час' },
    ];
  });

  // ---------- charts ----------

  private base(type: 'area' | 'line' | 'bar', height = 280): ApexOptions {
    const dark = this.theme.isDark();
    return {
      chart: {
        type, height, background: 'transparent', fontFamily: 'Manrope, sans-serif',
        toolbar: { show: false }, zoom: { enabled: false }, animations: { enabled: true, speed: 300 },
        foreColor: dark ? '#C4AE9E' : '#6F5546',
      },
      theme: { mode: dark ? 'dark' : 'light' },
      grid: { borderColor: dark ? '#2E2621' : '#F0E2D4', strokeDashArray: 3 },
      dataLabels: { enabled: false },
      legend: { position: 'top', horizontalAlign: 'left', fontWeight: 600 },
      tooltip: { theme: dark ? 'dark' : 'light', shared: true, intersect: false },
      stroke: { curve: 'smooth', width: 2 },
      yaxis: { min: 0, forceNiceScale: true, labels: { formatter: (v: number) => fmt(v) } },
    };
  }

  private labels = computed(() => {
    const s = this.series();
    if (!s) return [];
    return s.points.map(p => s.granularity === 'hour'
      ? `${shortDate(p.bucket)} ${p.bucket.slice(11, 16)}`
      : shortDate(p.bucket));
  });

  readonly trafficChart = computed<ApexOptions | null>(() => {
    const s = this.series();
    if (!s) return null;
    return {
      ...this.base('area'),
      colors: ['#D46743', '#E89B5B', '#5E8F94'],
      fill: { type: 'solid', opacity: [0.12, 0.08, 0] },
      series: [
        { name: 'Відвідувачі', data: s.points.map(p => p.visitors) },
        { name: 'Нові', data: s.points.map(p => p.newVisitors) },
        { name: 'Перегляди', data: s.points.map(p => p.pageviews) },
      ],
      xaxis: { categories: this.labels(), tickAmount: 12, labels: { rotate: 0, hideOverlappingLabels: true } },
    };
  });

  readonly activeChart = computed<ApexOptions | null>(() => {
    const s = this.series();
    if (!s) return null;
    return {
      ...this.base('line'),
      colors: ['#D46743', '#E89B5B', '#5E8F94'],
      series: [
        { name: 'DAU', data: s.active.map(a => a.dau) },
        { name: 'WAU', data: s.active.map(a => a.wau) },
        { name: 'MAU', data: s.active.map(a => a.mau) },
      ],
      xaxis: { categories: s.active.map(a => shortDate(a.bucket)), tickAmount: 12, labels: { rotate: 0, hideOverlappingLabels: true } },
    };
  });

  readonly votesChart = computed<ApexOptions | null>(() => {
    const s = this.series();
    if (!s) return null;
    const b = this.base('bar');
    return {
      ...b,
      chart: { ...b.chart, type: 'bar', stacked: true },
      colors: ['#D46743', '#8CC5CA', '#E89B5B'],
      plotOptions: { bar: { columnWidth: '60%', borderRadius: 2 } },
      series: [
        { name: 'Лайки', data: s.points.map(p => p.likes) },
        { name: 'Дизлайки', data: s.points.map(p => p.dislikes) },
        { name: 'Коментарі', data: s.points.map(p => p.comments) },
      ],
      xaxis: { categories: this.labels(), tickAmount: 12, labels: { rotate: 0, hideOverlappingLabels: true } },
    };
  });

  readonly onlineChart = computed<ApexOptions | null>(() => {
    const s = this.series();
    if (!s) return null;
    return {
      ...this.base('area', 220),
      colors: ['#5E8F94'],
      fill: { type: 'solid', opacity: 0.12 },
      stroke: { curve: 'stepline', width: 2 },
      series: [{ name: 'Пік онлайн', data: s.points.map(p => p.peakOnline) }],
      xaxis: { categories: this.labels(), tickAmount: 12, labels: { rotate: 0, hideOverlappingLabels: true } },
    };
  });

  // ---------- heatmap ----------

  readonly heat = computed(() => {
    const cells = this.breakdowns()?.heatmap ?? [];
    const map = new Map(cells.map(c => [`${c.dow}-${c.hour}`, c]));
    const max = Math.max(1, ...cells.map(c => c.visitors));
    return WEEKDAYS.map((label, i) => ({
      label,
      cells: this.hours.map(h => {
        const c = map.get(`${i + 1}-${h}`);
        const v = c?.visitors ?? 0;
        return { hour: h, visitors: v, pageviews: c?.pageviews ?? 0, alpha: v ? 0.12 + 0.88 * (v / max) : 0 };
      }),
    }));
  });

  // ---------- breakdown lists ----------

  private rows(key: string, label: (k: string) => string = k => k, icon?: (k: string) => string): AdminListRow[] {
    const list: BreakdownRow[] = this.breakdowns()?.breakdowns[key] ?? [];
    return list.map(r => ({ label: label(r.key), icon: icon?.(r.key), value: r.visitors, value2: r.pageviews }));
  }

  readonly countries = computed(() => this.rows('countries', countryName, flag));
  readonly pages = computed(() => this.rows('pages', pageName));
  readonly entryPages = computed(() => (this.breakdowns()?.breakdowns['entryPages'] ?? []).map(r => ({ label: pageName(r.key), value: r.visitors })));
  readonly referrers = computed(() => this.rows('referrers', k => REFERRER_NAMES[k] ?? k));
  readonly utmSources = computed(() => this.rows('utmSources').filter(r => r.label !== '—'));
  readonly utmCampaigns = computed(() => this.rows('utmCampaigns').filter(r => r.label !== '—'));
  readonly devices = computed(() => this.rows('devices', deviceName));
  readonly os = computed(() => this.rows('os'));
  readonly browsers = computed(() => this.rows('browsers'));
  readonly screens = computed(() => this.rows('screens', k => (k === 'unknown' ? 'Невідомо' : `${k} px`)));
  readonly themes = computed(() => this.rows('themes', k => THEME_NAMES[k] ?? k));
  readonly languages = computed(() => this.rows('languages', k => {
    if (k === 'unknown') return 'Невідомо';
    try { return new Intl.DisplayNames(['uk'], { type: 'language' }).of(k) ?? k; } catch { return k; }
  }));

  private teacherRows(list: CountRow[] | undefined): AdminListRow[] {
    return (list ?? []).map(r => ({ label: r.key, sub: r.sub, value: r.count, value2: r.count2, link: r.id ? ['/teacher', r.id] : null }));
  }

  readonly topLiked = computed(() => this.teacherRows(this.engagement()?.topLiked));
  readonly topDisliked = computed(() => this.teacherRows(this.engagement()?.topDisliked));
  readonly topCommented = computed(() => this.teacherRows(this.engagement()?.topCommented).map(r => ({ ...r, value2: null })));
  readonly topViewed = computed(() => this.teacherRows(this.engagement()?.topViewed));
  readonly topDepartments = computed(() => (this.engagement()?.topDepartments ?? []).map(r => ({ label: r.key, sub: r.sub, value: r.count, value2: r.count2 })));
  readonly topSwiped = computed(() => (this.engagement()?.topSwipedDepartments ?? []).map(r => ({ label: r.key, sub: r.sub, value: r.count })));
  readonly searches = computed(() => (this.engagement()?.searches ?? []).map(r => ({ label: r.key, value: r.count, value2: r.count2 })));
  readonly shares = computed(() => (this.engagement()?.shares ?? []).map(r => ({ label: SHARE_NAMES[r.key] ?? r.key, value: r.count })));

  readonly funnel = computed(() => {
    const steps = this.engagement()?.funnel ?? [];
    const first = steps[0]?.count || 0;
    return steps.map(s => ({ label: s.key, count: s.count, width: first ? Math.max(2, (s.count / first) * 100) : 0, pct: pct(s.count, first) }));
  });

  // ---------- live ----------

  readonly liveCountries = computed(() => (this.live()?.byCountry ?? []).map(c => ({ label: countryName(c.key), icon: flag(c.key), value: c.count })));
  readonly livePages = computed(() => (this.live()?.byPage ?? []).map(c => ({ label: pageName(c.key), value: c.count })));
  readonly liveDevices = computed(() => (this.live()?.byDevice ?? []).map(c => ({ label: deviceName(c.key), value: c.count })));

  // ---------- lifecycle ----------

  async ngOnInit() {
    this.load();
    this.admin.live().subscribe(s => this.liveInitial.set(s));
    await this.presence.joinAdminGroup().catch(() => {});
    this.refreshTimer = setInterval(() => this.load(true), 60_000);
  }

  ngOnDestroy() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.presence.leaveAdminGroup();
  }

  setPreset(preset: Preset) {
    const t = this.today;
    const ranges: Record<Exclude<Preset, 'custom'>, [string, string]> = {
      today: [t, t],
      yesterday: [addDays(t, -1), addDays(t, -1)],
      '7d': [addDays(t, -6), t],
      '30d': [addDays(t, -29), t],
      '90d': [addDays(t, -89), t],
      month: [`${t.slice(0, 8)}01`, t],
      all: [this.overview()?.firstEventDate ?? addDays(t, -364), t],
    };
    if (preset === 'custom') return;
    const [from, to] = ranges[preset];
    this.preset.set(preset);
    this.from.set(from);
    this.to.set(to);
    this.load();
  }

  setCustom(from: string, to: string) {
    if (!from || !to) return;
    if (from > to) [from, to] = [to, from];
    this.preset.set('custom');
    this.from.set(from);
    this.to.set(to > this.today ? this.today : to);
    this.load();
  }

  load(silent = false) {
    const from = this.from(), to = this.to();
    if (!silent) this.loading.set(true);

    let pending = 4;
    const done = () => {
      if (--pending === 0) {
        this.loading.set(false);
        this.lastUpdated.set(new Date());
      }
    };
    const fail = (err: { status?: number }) => {
      if (err?.status === 401) this.router.navigate(['/admin/login']);
      done();
    };

    this.admin.overview(from, to).subscribe({ next: v => { this.overview.set(v); done(); }, error: fail });
    this.admin.timeseries(from, to).subscribe({ next: v => { this.series.set(v); done(); }, error: fail });
    this.admin.breakdowns(from, to).subscribe({ next: v => { this.breakdowns.set(v); done(); }, error: fail });
    this.admin.engagement(from, to).subscribe({ next: v => { this.engagement.set(v); done(); }, error: fail });
  }

  logout() {
    this.admin.logout().subscribe(() => this.router.navigate(['/admin/login']));
  }

  rangeLabel(): string {
    const o = this.overview();
    if (!o) return '';
    return `${shortDate(o.range.from)}–${shortDate(o.range.to)} · ${o.range.days} дн. · порівняння з ${shortDate(o.previousRange.from)}–${shortDate(o.previousRange.to)}`;
  }
}
