export type LeaderboardPeriod = 'today' | 'week' | 'all';
export type LeaderboardSort = 'likes' | 'score' | 'comments';

export interface LeaderboardDepartment {
  id: string;
  shortName: string;
  longName: string;
  instituteId: string;
  instituteName: string;
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  fullName: string;
  position: string;
  personalPageUrl: string;
  photoUrl: string;
  likes: number;
  dislikes: number;
  numberOfComments: number;
  departments: LeaderboardDepartment[];
}

export interface LeaderboardQuery {
  search?: string;
  instituteId?: string;
  departmentId?: string;
  period: LeaderboardPeriod;
  sort: LeaderboardSort;
  pageNumber: number;
  pageSize: number;
}

export interface TodaysCrush {
  date: string;
  worker: LeaderboardEntry | null;
  totalLikesToday: number;
}

/** What the teacher sheet (comments) shows in its header. */
export interface TeacherSummary {
  id: string;
  fullName: string;
  position: string;
  photoUrl: string;
  personalPageUrl?: string;
  likes?: number;
  dislikes?: number;
  subtitle?: string;
}

export interface DailyVotes {
  date: string;
  likes: number;
  dislikes: number;
}

export interface TeacherProfile {
  id: string;
  fullName: string;
  position: string;
  personalPageUrl: string;
  photoUrl: string;
  departments: LeaderboardDepartment[];
  likes: number;
  dislikes: number;
  numberOfComments: number;
  likesToday: number;
  dislikesToday: number;
  likesWeek: number;
  dislikesWeek: number;
  rankOverall: number;
  totalTeachers: number;
  rankInDepartment: number | null;
  departmentSize: number | null;
  rankDepartmentId: string | null;
  crushDays: number;
  daily: DailyVotes[];
}
