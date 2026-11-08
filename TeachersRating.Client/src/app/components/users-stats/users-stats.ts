import { Component, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { PresenceService } from '../../services/presence/presence.service';
import { AsyncPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, provideNativeDateAdapter } from '@angular/material/core';
import {
  ChartComponent,
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexDataLabels,
  ApexTitleSubtitle,
  ApexStroke,
  ApexGrid,
  NgApexchartsModule
} from "ng-apexcharts";
import { UsersStatsService } from '../../services/users-stats/users-stats.service';
import { UsersStats } from '../../models/users-stats.model';
import { ThemeService } from '../../services/theme/theme.service';

import { ApexTooltip, ApexFill } from "ng-apexcharts";

export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  dataLabels: ApexDataLabels;
  grid: ApexGrid;
  stroke: ApexStroke;
  title: ApexTitleSubtitle;
  tooltip: ApexTooltip;
};

@Component({
  selector: 'app-users-stats',
  standalone: true,
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    NgApexchartsModule
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './users-stats.html'
})
export class UsersStatsComponent implements OnInit, OnDestroy {

  @ViewChild("chart") chart?: ChartComponent;
  public chartOptions?: Partial<ChartOptions>;

  public presenceService = inject(PresenceService);
  public theme = inject(ThemeService);
  public chartColors = ['#D46743'];
  public chartFill: ApexFill = { type: 'solid', opacity: 0.12 };
  private usersStatsService = inject(UsersStatsService);

  public range = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });

  get start() { return this.range.get('start') as FormControl; }
  get end() { return this.range.get('end') as FormControl; }

  constructor() {
    this.chartOptions = {
      series: [
        {
          name: "Онлайн користувачів",
          data: []
        }
      ],
      chart: {
        height: 340,
        type: "area",
        background: "transparent",
        fontFamily: "Manrope, sans-serif",
        toolbar: { show: false },
        zoom: {
          enabled: false
        }
      },
      dataLabels: {
        enabled: false
      },
      stroke: {
        curve: "smooth",
        width: 3
      },
      title: {
        text: "Онлайн за період",
        align: "left",
        style: { fontWeight: 800 }
      },
      grid: {
        borderColor: "rgba(164, 139, 124, 0.2)",
        strokeDashArray: 4
      },
      xaxis: {
        categories: []
      }
    };

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    this.range.setValue({ start: yesterday, end: today });
  }

  async ngOnInit() {
    await this.presenceService.joinAdminGroup();
    this.loadStats();
  }

  async ngOnDestroy() {
    await this.presenceService.leaveAdminGroup();
  }

  onRangeChange() {
    this.loadStats();
  }

  private loadStats() {
    const start = this.start.value;
    const end = this.end.value;

    if (!start || !end) {
      return;
    }

    this.usersStatsService.getStatsByDateRange(start, end).subscribe({
      next: (stats: UsersStats[]) => {
        this.updateChart(stats);
      },
      error: (error) => {
        console.error('Error loading stats:', error);
      }
    });
  }

  private updateChart(stats: UsersStats[]) {
    const sortedStats = [...stats].sort((a, b) => 
      new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
    );

    const categories = sortedStats.map(stat => 
      new Date(stat.dateCreated).toLocaleDateString('uk-UA', { 
        month: 'short', 
        day: 'numeric' 
      })
    );

    const data = sortedStats.map(stat => stat.numberOfOnlineUsers);

    this.chartOptions = {
      ...this.chartOptions,
      series: [
        {
          name: "Онлайн користувачів",
          data: data
        }
      ],
      xaxis: {
        categories: categories
      },
      tooltip: {
        custom: ({ series, seriesIndex, dataPointIndex, w }) => {
          const stat = sortedStats[dataPointIndex];
          const date = new Date(stat.dateCreated);
          const formattedDate = date.toLocaleDateString('uk-UA', { 
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          });
          const formattedTime = date.toLocaleTimeString('uk-UA', {
            hour: '2-digit',
            minute: '2-digit'
          });
          
          return `<div style="padding: 10px 12px; font-family: Manrope, sans-serif;">
            <div style="font-weight: 800; margin-bottom: 4px;">${formattedDate}, ${formattedTime}</div>
            <div style="color: #D46743; font-weight: 800;">Онлайн: ${series[seriesIndex][dataPointIndex]}</div>
          </div>`;
        }
      }
    };
  }
}
