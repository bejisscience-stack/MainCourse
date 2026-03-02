import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getAuthenticatedUser, checkIsAdmin } from '../_shared/auth.ts'
import { createServiceRoleClient } from '../_shared/supabase.ts'

// Inline platform detection (can't import from lib/ in Deno edge functions)
function detectPlatform(url: string): 'tiktok' | 'instagram' | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    if (hostname.includes('tiktok.com')) return 'tiktok'
    if (hostname.includes('instagram.com')) return 'instagram'
    return null
  } catch {
    return null
  }
}

function normalizeUrl(url: string): string {
  return url.toLowerCase().replace(/\/+$/, '').replace(/\?.*$/, '')
}

interface VideoEntry {
  submissionId: string
  projectId: string
  userId: string
  platform: 'tiktok' | 'instagram'
  originalUrl: string
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  try {
    // --- Auth: dual model (secret header OR Bearer JWT) ---
    let triggeredBy: string | null = null
    let triggerType: 'scheduled' | 'manual' = 'scheduled'

    const scraperSecret = req.headers.get('x-scraper-secret')
    const expectedSecret = Deno.env.get('VIEW_SCRAPER_SECRET')

    if (scraperSecret && expectedSecret && scraperSecret === expectedSecret) {
      // Scheduled run via pg_cron — no user context
      triggerType = 'scheduled'
      triggeredBy = null
    } else {
      // Manual run — require admin JWT
      const auth = await getAuthenticatedUser(req)
      if ('response' in auth) return auth.response

      const serviceClient = createServiceRoleClient(auth.token)
      const isAdmin = await checkIsAdmin(serviceClient, auth.user.id)
      if (!isAdmin) return errorResponse('Forbidden: admin only', 403)

      triggerType = 'manual'
      triggeredBy = auth.user.id
    }

    // Parse optional filters from body
    let projectIdFilter: string | null = null
    let submissionIdFilter: string | null = null
    try {
      const body = await req.json()
      projectIdFilter = body.project_id || null
      submissionIdFilter = body.submission_id || null
    } catch {
      // Empty body is fine
    }

    const adminClient = createServiceRoleClient()
    const apifyToken = Deno.env.get('APIFY_API_TOKEN')
    if (!apifyToken) {
      return errorResponse('APIFY_API_TOKEN not configured', 500)
    }

    // Create run record
    const { data: run, error: runError } = await adminClient
      .from('view_scrape_runs')
      .insert({
        triggered_by: triggeredBy,
        trigger_type: triggerType,
        status: 'running',
      })
      .select('id')
      .single()

    if (runError || !run) {
      console.error('Failed to create run record:', runError)
      return errorResponse('Failed to create scrape run', 500)
    }

    const runId = run.id

    // Fetch active submissions
    let query = adminClient
      .from('project_submissions')
      .select(`
        id,
        user_id,
        project_id,
        video_url,
        platform_links,
        status,
        projects!inner (
          id,
          end_date
        )
      `)
      .in('status', ['approved', 'pending'])

    if (submissionIdFilter) {
      query = query.eq('id', submissionIdFilter)
    } else if (projectIdFilter) {
      query = query.eq('project_id', projectIdFilter)
    }

    const { data: submissions, error: subError } = await query

    if (subError) {
      console.error('Failed to fetch submissions:', subError)
      await adminClient.from('view_scrape_runs').update({
        status: 'failed',
        error_log: `Failed to fetch submissions: ${subError.message}`,
        completed_at: new Date().toISOString(),
      }).eq('id', runId)
      return errorResponse('Failed to fetch submissions', 500)
    }

    // Extract all video URLs grouped by platform
    const videoEntries: VideoEntry[] = []
    for (const sub of submissions || []) {
      const project = (sub as any).projects
      // Skip if project has ended
      if (project?.end_date && new Date(project.end_date) < new Date()) continue

      // Extract from platform_links
      if (sub.platform_links && typeof sub.platform_links === 'object') {
        for (const [, url] of Object.entries(sub.platform_links as Record<string, string>)) {
          if (typeof url === 'string' && url.trim()) {
            const platform = detectPlatform(url)
            if (platform) {
              videoEntries.push({
                submissionId: sub.id,
                projectId: sub.project_id,
                userId: sub.user_id,
                platform,
                originalUrl: url,
              })
            }
          }
        }
      }

      // Fallback to video_url
      if (sub.video_url) {
        const platform = detectPlatform(sub.video_url)
        if (platform) {
          const alreadyHasUrl = videoEntries.some(
            (e) => e.submissionId === sub.id && normalizeUrl(e.originalUrl) === normalizeUrl(sub.video_url!)
          )
          if (!alreadyHasUrl) {
            videoEntries.push({
              submissionId: sub.id,
              projectId: sub.project_id,
              userId: sub.user_id,
              platform,
              originalUrl: sub.video_url,
            })
          }
        }
      }
    }

    if (videoEntries.length === 0) {
      await adminClient.from('view_scrape_runs').update({
        status: 'completed',
        total_urls: 0,
        successful: 0,
        failed: 0,
        completed_at: new Date().toISOString(),
      }).eq('id', runId)

      return jsonResponse({ run_id: runId, status: 'completed', message: 'No video URLs to scrape' })
    }

    // Update total count
    await adminClient.from('view_scrape_runs').update({
      total_urls: videoEntries.length,
    }).eq('id', runId)

    // Group by platform
    const tiktokEntries = videoEntries.filter((e) => e.platform === 'tiktok')
    const instagramEntries = videoEntries.filter((e) => e.platform === 'instagram')

    let successCount = 0
    let failCount = 0
    const errors: string[] = []

    // --- Scrape TikTok via Apify ---
    if (tiktokEntries.length > 0) {
      try {
        const tiktokUrls = tiktokEntries.map((e) => e.originalUrl)
        const actorResponse = await fetch(
          `https://api.apify.com/v2/acts/clockworks~free-tiktok-scraper/runs?token=${apifyToken}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              postURLs: tiktokUrls,
              shouldDownloadCovers: false,
              shouldDownloadVideos: false,
              shouldDownloadSlideshowImages: false,
            }),
            signal: AbortSignal.timeout(120_000),
          }
        )

        if (!actorResponse.ok) {
          throw new Error(`Apify TikTok actor returned ${actorResponse.status}`)
        }

        const actorData = await actorResponse.json()
        const datasetId = actorData?.data?.defaultDatasetId

        if (datasetId) {
          // Wait for run to complete (poll)
          const runId2 = actorData?.data?.id
          if (runId2) {
            await waitForApifyRun(apifyToken, runId2)
          }

          // Fetch results
          const datasetResponse = await fetch(
            `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}`,
            { signal: AbortSignal.timeout(30_000) }
          )
          const results = await datasetResponse.json()

          // Build lookup: normalized URL → result
          const resultMap = new Map<string, any>()
          for (const item of results) {
            const webUrl = item.webVideoUrl || item.url || ''
            if (webUrl) {
              resultMap.set(normalizeUrl(webUrl), item)
            }
          }

          // Match back to entries
          for (const entry of tiktokEntries) {
            const result = resultMap.get(normalizeUrl(entry.originalUrl))
            if (result && result.playCount !== undefined) {
              await insertResult(adminClient, {
                submissionId: entry.submissionId,
                projectId: entry.projectId,
                userId: entry.userId,
                scrapeRunId: runId,
                platform: 'tiktok',
                videoUrl: entry.originalUrl,
                viewCount: result.playCount ?? null,
                likeCount: result.diggCount ?? result.likesCount ?? null,
                commentCount: result.commentCount ?? null,
                shareCount: result.shareCount ?? null,
                saveCount: result.collectCount ?? null,
              })
              successCount++
            } else {
              await insertResult(adminClient, {
                submissionId: entry.submissionId,
                projectId: entry.projectId,
                userId: entry.userId,
                scrapeRunId: runId,
                platform: 'tiktok',
                videoUrl: entry.originalUrl,
                errorMessage: result ? 'No view count in response' : 'URL not found in results',
              })
              failCount++
            }
          }
        }
      } catch (err) {
        const msg = `TikTok scrape error: ${err instanceof Error ? err.message : String(err)}`
        console.error(msg)
        errors.push(msg)
        failCount += tiktokEntries.length
      }
    }

    // --- Scrape Instagram via Apify ---
    if (instagramEntries.length > 0) {
      try {
        const igUrls = instagramEntries.map((e) => e.originalUrl)
        const actorResponse = await fetch(
          `https://api.apify.com/v2/acts/apify~instagram-scraper/runs?token=${apifyToken}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              directUrls: igUrls,
              resultsType: 'posts',
              resultsLimit: igUrls.length,
            }),
            signal: AbortSignal.timeout(120_000),
          }
        )

        if (!actorResponse.ok) {
          throw new Error(`Apify Instagram actor returned ${actorResponse.status}`)
        }

        const actorData = await actorResponse.json()
        const datasetId = actorData?.data?.defaultDatasetId

        if (datasetId) {
          const runId2 = actorData?.data?.id
          if (runId2) {
            await waitForApifyRun(apifyToken, runId2)
          }

          const datasetResponse = await fetch(
            `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}`,
            { signal: AbortSignal.timeout(30_000) }
          )
          const results = await datasetResponse.json()

          const resultMap = new Map<string, any>()
          for (const item of results) {
            const itemUrl = item.url || item.shortCode ? `https://www.instagram.com/reel/${item.shortCode}/` : ''
            if (itemUrl) {
              resultMap.set(normalizeUrl(itemUrl), item)
            }
          }

          for (const entry of instagramEntries) {
            const result = resultMap.get(normalizeUrl(entry.originalUrl))
            if (result && (result.videoViewCount !== undefined || result.videoPlayCount !== undefined)) {
              await insertResult(adminClient, {
                submissionId: entry.submissionId,
                projectId: entry.projectId,
                userId: entry.userId,
                scrapeRunId: runId,
                platform: 'instagram',
                videoUrl: entry.originalUrl,
                viewCount: result.videoViewCount ?? result.videoPlayCount ?? null,
                likeCount: result.likesCount ?? null,
                commentCount: result.commentsCount ?? null,
                shareCount: null,
                saveCount: null,
              })
              successCount++
            } else {
              await insertResult(adminClient, {
                submissionId: entry.submissionId,
                projectId: entry.projectId,
                userId: entry.userId,
                scrapeRunId: runId,
                platform: 'instagram',
                videoUrl: entry.originalUrl,
                errorMessage: result ? 'No view count in response' : 'URL not found in results',
              })
              failCount++
            }
          }
        }
      } catch (err) {
        const msg = `Instagram scrape error: ${err instanceof Error ? err.message : String(err)}`
        console.error(msg)
        errors.push(msg)
        failCount += instagramEntries.length
      }
    }

    // Update run record
    const finalStatus = failCount === videoEntries.length ? 'failed' : 'completed'
    await adminClient.from('view_scrape_runs').update({
      status: finalStatus,
      successful: successCount,
      failed: failCount,
      completed_at: new Date().toISOString(),
      error_log: errors.length > 0 ? errors.join('\n') : null,
    }).eq('id', runId)

    return jsonResponse({
      run_id: runId,
      status: finalStatus,
      total_urls: videoEntries.length,
      successful: successCount,
      failed: failCount,
    })

  } catch (err) {
    console.error('View scraper error:', err)
    return errorResponse(err instanceof Error ? err.message : 'Internal server error', 500)
  }
})

// --- Helpers ---

async function waitForApifyRun(token: string, runId: string, maxWaitMs = 120_000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`,
      { signal: AbortSignal.timeout(10_000) }
    )
    const data = await res.json()
    const status = data?.data?.status
    if (status === 'SUCCEEDED' || status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      return
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
}

interface InsertResultParams {
  submissionId: string
  projectId: string
  userId: string
  scrapeRunId: string
  platform: 'tiktok' | 'instagram'
  videoUrl: string
  viewCount?: number | null
  likeCount?: number | null
  commentCount?: number | null
  shareCount?: number | null
  saveCount?: number | null
  errorMessage?: string | null
}

async function insertResult(client: any, params: InsertResultParams) {
  const { error } = await client.from('view_scrape_results').insert({
    submission_id: params.submissionId,
    project_id: params.projectId,
    user_id: params.userId,
    scrape_run_id: params.scrapeRunId,
    platform: params.platform,
    video_url: params.videoUrl,
    view_count: params.viewCount ?? null,
    like_count: params.likeCount ?? null,
    comment_count: params.commentCount ?? null,
    share_count: params.shareCount ?? null,
    save_count: params.saveCount ?? null,
    error_message: params.errorMessage ?? null,
  })

  if (error) {
    console.error('Failed to insert scrape result:', error)
  }

  // Update the submission's latest_views cache
  if (params.viewCount != null) {
    const viewsUpdate: Record<string, any> = {}
    viewsUpdate[params.platform] = {
      view_count: params.viewCount,
      like_count: params.likeCount,
      comment_count: params.commentCount,
      share_count: params.shareCount,
      save_count: params.saveCount,
      scraped_at: new Date().toISOString(),
    }

    // Merge with existing latest_views
    const { data: existing } = await client
      .from('project_submissions')
      .select('latest_views')
      .eq('id', params.submissionId)
      .single()

    const merged = { ...(existing?.latest_views || {}), ...viewsUpdate }

    await client.from('project_submissions').update({
      latest_views: merged,
      last_scraped_at: new Date().toISOString(),
    }).eq('id', params.submissionId)
  }
}
