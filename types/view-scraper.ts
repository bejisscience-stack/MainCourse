export type Platform = "tiktok" | "instagram";

export type ScrapeRunStatus = "running" | "completed" | "failed";
export type ScrapeTriggerType = "scheduled" | "manual";

export interface ViewScrapeRun {
  id: string;
  triggered_by: string | null;
  trigger_type: ScrapeTriggerType;
  status: ScrapeRunStatus;
  total_urls: number;
  successful: number;
  failed: number;
  started_at: string;
  completed_at: string | null;
  error_log: string | null;
  // Joined from profiles
  triggered_by_username?: string | null;
}

export interface ViewScrapeResult {
  id: string;
  submission_id: string;
  project_id: string;
  user_id: string;
  scrape_run_id: string | null;
  platform: Platform;
  video_url: string;
  view_count: number | null;
  like_count: number | null;
  comment_count: number | null;
  share_count: number | null;
  save_count: number | null;
  error_message: string | null;
  scraped_at: string;
}

export interface SubmissionReviewData {
  id: string;
  platform: string | null;
  payment_amount: number; // RPM (sum of matched criteria)
  payout_amount: number; // Calculated: (views/1000) * RPM
  paid_at: string | null;
  paid_by: string | null;
}

export interface SubmissionWithViews {
  id: string;
  user_id: string;
  project_id: string;
  video_url: string | null;
  platform_links: Record<string, string> | null;
  latest_views: Record<string, any>;
  last_scraped_at: string | null;
  created_at: string;
  // Joined
  username: string;
  avatar_url: string | null;
  project_title: string;
  course_title: string;
  course_id: string;
  min_views: number | null;
  max_views: number | null;
  platforms: string[] | null;
  reviews: SubmissionReviewData[];
}

export interface ViewScrapeResultEnriched extends ViewScrapeResult {
  username: string;
  course_title: string;
}

export interface ViewScraperProgress {
  completed: number;
  total: number;
  lastUrl: string | null;
}
