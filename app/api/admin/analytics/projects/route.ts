import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, isAuthError, internalError } from '@/lib/admin-auth';
import type { ProjectStats, ProjectByCourse, PlatformCount } from '@/types/analytics';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminRequest(request);
    if (isAuthError(auth)) return auth;

    const { serviceSupabase } = auth;

    const [projectsResult, submissionsResult, reviewsResult] = await Promise.all([
      serviceSupabase
        .from('projects')
        .select('id, course_id, budget, platforms, courses(id, title)'),

      serviceSupabase
        .from('project_submissions')
        .select('id, project_id'),

      serviceSupabase
        .from('submission_reviews')
        .select('id, submission_id'),
    ]);

    const projects = projectsResult.data || [];
    const submissions = submissionsResult.data || [];
    const reviews = reviewsResult.data || [];

    // Count submissions per project
    const submissionsByProject = new Map<string, number>();
    for (const sub of submissions) {
      const current = submissionsByProject.get(sub.project_id) || 0;
      submissionsByProject.set(sub.project_id, current + 1);
    }

    // Aggregate by course
    const byCourseMap = new Map<string, ProjectByCourse>();
    for (const project of projects) {
      const courseId = project.course_id;
      const budget = Number(project.budget || 0);
      const subs = submissionsByProject.get(project.id) || 0;
      const existing = byCourseMap.get(courseId);
      if (existing) {
        existing.projectCount += 1;
        existing.totalBudget += budget;
        existing.averageBudget = existing.totalBudget / existing.projectCount;
        existing.submissionCount += subs;
      } else {
        byCourseMap.set(courseId, {
          courseId,
          courseTitle: (project as Record<string, any>).courses?.title || 'Unknown Course',
          projectCount: 1,
          totalBudget: budget,
          averageBudget: budget,
          submissionCount: subs,
        });
      }
    }

    // Aggregate platform distribution
    const platformMap = new Map<string, number>();
    for (const project of projects) {
      const platforms: string[] = (project as Record<string, any>).platforms || [];
      for (const platform of platforms) {
        const current = platformMap.get(platform) || 0;
        platformMap.set(platform, current + 1);
      }
    }

    const totalBudget = projects.reduce((sum: number, p: Record<string, any>) => {
      return sum + Number(p.budget || 0);
    }, 0);

    const stats: ProjectStats = {
      totalProjects: projects.length,
      totalBudget,
      averageBudget: projects.length > 0 ? totalBudget / projects.length : 0,
      projectsByCourse: Array.from(byCourseMap.values())
        .sort((a, b) => b.projectCount - a.projectCount),
      platformDistribution: Array.from(platformMap.entries())
        .map(([platform, count]): PlatformCount => ({ platform, count }))
        .sort((a, b) => b.count - a.count),
      totalSubmissions: submissions.length,
      totalReviews: reviews.length,
    };

    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (error) {
    return internalError('Analytics Projects API', error);
  }
}
