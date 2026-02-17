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
