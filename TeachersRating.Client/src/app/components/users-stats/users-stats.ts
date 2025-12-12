import { Component, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { PresenceService } from '../../services/presence/presence.service';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
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

import { ApexTooltip } from "ng-apexcharts";

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
    RouterLink,
    ReactiveFormsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    NgApexchartsModule
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './users-stats.html',
  styleUrls: ['./users-stats.scss']
})
export class UsersStatsComponent implements OnInit, OnDestroy {

  @ViewChild("chart") chart?: ChartComponent;
  public chartOptions?: Partial<ChartOptions>;

  public presenceService = inject(PresenceService);
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
        height: 350,
        type: "line",
        zoom: {
          enabled: false
        }
      },
      dataLabels: {
        enabled: false
      },
      stroke: {
        curve: "straight"
      },
      title: {
        text: "Графік користувачів онлайн",
        align: "left"
      },
      grid: {
        row: {
          colors: ["#f3f3f3", "transparent"],
          opacity: 0.5
        }
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
          
          return `<div style="padding: 10px; background: white; border: 1px solid #e0e0e0; border-radius: 4px;">
            <div style="font-weight: 600; margin-bottom: 5px;">${formattedDate}</div>
            <div style="color: #666; margin-bottom: 5px;">Час: ${formattedTime}</div>
            <div style="color: #2196f3; font-weight: 600;">Користувачів: ${series[seriesIndex][dataPointIndex]}</div>
          </div>`;
        }
      }
    };
  }
}
