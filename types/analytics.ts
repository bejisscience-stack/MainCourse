// Admin Analytics Types — shared between API endpoints and frontend

export interface AnalyticsOverview {
  waitingListCount: number;
  totalRevenue: number;
  totalEnrollments: number;
  totalReferrals: number;
  totalProjects: number;
  totalProjectBudget: number;
  totalBundleRevenue: number;
  totalBundleEnrollments: number;
}

export interface CourseRevenue {
  courseId: string;
  courseTitle: string;
  courseType: string;
  price: number;
  enrollmentCount: number;
  totalRevenue: number;
}

export interface RevenueData {
  courses: CourseRevenue[];
  totalRevenue: number;
  totalBundleRevenue: number;
  bundleRevenue: BundleRevenue[];
}

export interface BundleRevenue {
  bundleId: string;
  bundleTitle: string;
  price: number;
  enrollmentCount: number;
  totalRevenue: number;
}

export interface ReferralStats {
  totalActivations: number;
  referralsByCourse: ReferralByCourse[];
  topReferrers: TopReferrer[];
}

export interface ReferralByCourse {
  courseId: string;
  courseTitle: string;
  count: number;
}

export interface TopReferrer {
  userId: string;
  username: string;
  email: string;
  referralCode: string;
  activationCount: number;
  totalCommission: number;
}

export interface ProjectStats {
  totalProjects: number;
  totalBudget: number;
  averageBudget: number;
  projectsByCourse: ProjectByCourse[];
  platformDistribution: PlatformCount[];
  totalSubmissions: number;
  totalReviews: number;
}

export interface ProjectByCourse {
  courseId: string;
  courseTitle: string;
  projectCount: number;
  totalBudget: number;
  averageBudget: number;
  submissionCount: number;
}

export interface PlatformCount {
  platform: string;
  count: number;
}

// ─── CEO Dashboard Analytics Types ──────────────────────────────────

export interface DateCount {
  date: string;
  count: number;
}

export interface RoleCount {
  role: string;
  count: number;
}

export interface UserAnalytics {
  totalUsers: number;
  newSignups: DateCount[];
  roleDistribution: RoleCount[];
  dau: number;
  wau: number;
  mau: number;
  stickiness: number;
  signupGrowthRate: number;
  profileCompletionRate: number;
}

export interface EnrollmentFunnel {
  pending: number;
  approved: number;
  rejected: number;
}

export interface ActiveCourse {
  courseId: string;
  title: string;
  messageCount: number;
}

export interface ZeroEnrollmentCourse {
  courseId: string;
  title: string;
}

export interface EngagementAnalytics {
  enrollmentFunnel: EnrollmentFunnel;
  conversionRate: number;
  messagesPerDay: DateCount[];
  mostActiveCourses: ActiveCourse[];
  avgEnrollmentsPerUser: number;
  coursesWithZeroEnrollments: ZeroEnrollmentCourse[];
}

export interface DateAmount {
  date: string;
  amount: number;
}

export interface LecturerRevenue {
  lecturerId: string;
  name: string;
  revenue: number;
}

export interface BalanceFlowDay {
  date: string;
  referral_commission: number;
  course_purchase: number;
  withdrawal: number;
  admin_adjustment: number;
}

export interface WithdrawalTrendDay {
  date: string;
  amount: number;
  count: number;
}

export interface FinancialAnalytics {
  revenueOverTime: DateAmount[];
  revenueByLecturer: LecturerRevenue[];
  averageOrderValue: number;
  balanceFlow: BalanceFlowDay[];
  outstandingBalances: number;
  withdrawalTrend: WithdrawalTrendDay[];
  avgWithdrawalAmount: number;
  totalPaidOut: number;
  totalEarned: number;
}

export interface PendingQueue {
  count: number;
  oldestAgeHours: number;
}

export interface PendingWithdrawalQueue extends PendingQueue {
  totalAmount: number;
}

export interface OperationalAnalytics {
  pendingEnrollments: PendingQueue;
  pendingWithdrawals: PendingWithdrawalQueue;
  pendingLecturers: PendingQueue;
  avgEnrollmentProcessingHours: number;
  avgWithdrawalProcessingHours: number;
}
