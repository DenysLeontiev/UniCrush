export interface KeyCount {
  key: string;
  count: number;
}

export interface LiveSession {
  visitor: string;
  country: string;
  device: string;
  os: string;
  browser: string;
  page: string;
  path: string | null;
  connectedAt: string;
}

export interface LiveSnapshot {
  onlineVisitors: number;
  openTabs: number;
  byCountry: KeyCount[];
  byPage: KeyCount[];
  byDevice: KeyCount[];
  sessions: LiveSession[];
}

export interface PeriodStats {
  visitors: number;
  newVisitors: number;
  sessions: number;
  pageviews: number;
  avgSessionSeconds: number;
  pagesPerSession: number;
  bounceRate: number;
  searches: number;
  shares: number;
  likes: number;
  dislikes: number;
  comments: number;
  peakOnline: number;
  dailyVisitorsSum: number;
}

export interface DashboardOverview {
  range: { from: string; to: string; days: number };
  previousRange: { from: string; to: string };
  current: PeriodStats;
  previous: PeriodStats;
  active: { dau: number; wau: number; mau: number };
  avgDau: number;
  onlineNow: number;
  totals: { visitors: number; teachers: number; likes: number; dislikes: number; comments: number; hiddenComments: number };
  firstEventDate: string | null;
}

export interface TimePoint {
  bucket: string;
  visitors: number;
  newVisitors: number;
  sessions: number;
  pageviews: number;
  likes: number;
  dislikes: number;
  comments: number;
  peakOnline: number;
}

export interface ActivePoint {
  bucket: string;
  dau: number;
  wau: number;
  mau: number;
}

export interface DashboardTimeseries {
  granularity: 'hour' | 'day' | 'week';
  points: TimePoint[];
  active: ActivePoint[];
}

export interface BreakdownRow {
  key: string;
  visitors: number;
  pageviews: number;
}

export interface HeatCell {
  dow: number;
  hour: number;
  visitors: number;
  pageviews: number;
}

export interface DashboardBreakdowns {
  breakdowns: Record<string, BreakdownRow[]>;
  heatmap: HeatCell[];
}

export interface CountRow {
  id?: string | null;
  key: string;
  sub?: string | null;
  count: number;
  count2: number;
}

export interface DashboardEngagement {
  topLiked: CountRow[];
  topDisliked: CountRow[];
  topCommented: CountRow[];
  topViewed: CountRow[];
  topDepartments: CountRow[];
  topSwipedDepartments: CountRow[];
  searches: CountRow[];
  shares: CountRow[];
  funnel: CountRow[];
  votesPerVoter: number;
}

export interface AdminComment {
  id: string;
  content: string;
  authorName: string | null;
  dateCreated: string;
  isHidden: boolean;
  parentCommentId: string | null;
  parentContent: string | null;
  repliesCount: number;
  workerId: string;
  workerName: string;
}

export type OnlineGranularity = 'minute' | 'hour' | 'day' | 'week' | 'month';

export interface DashboardOnline {
  granularity: OnlineGranularity;
  now: number;
  average: number | null;
  peak: { value: number; at: string } | null;
  samples: number;
  points: { bucket: string; avg: number | null; peak: number | null; samples: number }[];
  byHour: { hour: number; avg: number | null; peak: number | null }[];
  byWeekday: { dow: number; avg: number | null; peak: number | null }[];
}

export interface PerfRow {
  key: string;
  median: number;
  p75: number;
  samples: number;
}

export interface DashboardBehavior {
  engagedSeconds: number;
  avgSecondsPerVisitor: number;
  avgSecondsPerSession: number;
  timeByPage: BreakdownRow[];
  voteMethods: CountRow[];
  votes: number;
  skips: number;
  skipRate: number;
  filters: CountRow[];
  loadMore: CountRow[];
  openComments: CountRow[];
  outbound: CountRow[];
  themeToggles: CountRow[];
  errors: CountRow[];
  perfByDevice: PerfRow[];
}
