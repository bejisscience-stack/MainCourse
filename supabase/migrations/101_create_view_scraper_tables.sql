-- ============================================================
-- Migration 101: View Scraper Bot Tables
-- Tracks automated view count scraping from TikTok/Instagram
-- ============================================================

-- 1. view_scrape_runs — tracks each bot execution
CREATE TABLE IF NOT EXISTS view_scrape_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('scheduled', 'manual')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  total_urls INTEGER NOT NULL DEFAULT 0,
  successful INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_log TEXT
);

-- RLS: admins only
ALTER TABLE view_scrape_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all scrape runs"
  ON view_scrape_runs FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can insert scrape runs"
  ON view_scrape_runs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update scrape runs"
  ON view_scrape_runs FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 2. view_scrape_results — individual URL scrape results
CREATE TABLE IF NOT EXISTS view_scrape_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES project_submissions(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scrape_run_id UUID REFERENCES view_scrape_runs(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram')),
  video_url TEXT NOT NULL,
  view_count INTEGER,
  like_count INTEGER,
  comment_count INTEGER,
  share_count INTEGER,
  save_count INTEGER,
  error_message TEXT,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_view_scrape_results_submission
  ON view_scrape_results (submission_id, platform, scraped_at DESC);

CREATE INDEX idx_view_scrape_results_project
  ON view_scrape_results (project_id, scraped_at DESC);

CREATE INDEX idx_view_scrape_results_run
  ON view_scrape_results (scrape_run_id);

-- RLS: admins see all, lecturers see their projects, students see own
ALTER TABLE view_scrape_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all scrape results"
  ON view_scrape_results FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Lecturers can view results for their projects"
  ON view_scrape_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN courses c ON c.id = p.course_id
      WHERE p.id = view_scrape_results.project_id
        AND c.lecturer_id = auth.uid()
    )
  );

CREATE POLICY "Students can view own results"
  ON view_scrape_results FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can insert scrape results"
  ON view_scrape_results FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 3. Add latest_views cache and last_scraped_at to project_submissions
ALTER TABLE project_submissions
  ADD COLUMN IF NOT EXISTS latest_views JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMPTZ;

-- 4. Enable Realtime on new tables
ALTER PUBLICATION supabase_realtime ADD TABLE view_scrape_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE view_scrape_results;
