import { Component, ElementRef, OnDestroy, effect, input, untracked, viewChild } from '@angular/core';
import type { ApexOptions } from 'apexcharts';
import type ApexChartsType from 'apexcharts';

/** Thin ApexCharts wrapper: pass one options object; re-renders when it changes. */
@Component({
  selector: 'app-admin-chart',
  template: `<div #host class="chart-host"></div>`,
})
export class AdminChart implements OnDestroy {
  readonly options = input<ApexOptions | null>(null);
  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');

  private chart?: ApexChartsType;
  private queue: Promise<void> = Promise.resolve();

  constructor() {
    effect(() => {
      const options = this.options();
      if (!options) return;
      untracked(() => {
        this.queue = this.queue.then(() => this.render(options)).catch(() => {});
      });
    });
  }

  private async render(options: ApexOptions) {
    if (this.chart) {
      await this.chart.updateOptions(options, true, true);
      return;
    }
    const { default: ApexCharts } = await import('apexcharts');
    this.chart = new ApexCharts(this.host().nativeElement, options);
    await this.chart.render();
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }
}
