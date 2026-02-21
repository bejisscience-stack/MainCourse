import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCors, jsonResponse } from '../_shared/cors.ts'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  checks: {
    database: {
      status: 'ok' | 'error'
      latency?: number
      error?: string
    }
    supabase: {
      status: 'ok' | 'error'
      error?: string
    }
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  // Only allow GET
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const startTime = Date.now()
  const healthStatus: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: 'ok' },
      supabase: { status: 'ok' },
    },
  }

  // Check Supabase client initialization and database connectivity
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    healthStatus.checks.supabase.status = 'ok'

    // Check database connectivity with simple query
    const dbStartTime = Date.now()
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)

    const dbLatency = Date.now() - dbStartTime
    healthStatus.checks.database.latency = dbLatency

    if (error) {
      healthStatus.checks.database.status = 'error'
      healthStatus.checks.database.error = error.message
      healthStatus.status = 'degraded'
      console.error('[Health Check] Database error:', error.message)
    } else {
      console.log('[Health Check] Database OK, latency:', dbLatency, 'ms')
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'

    if (errorMessage.includes('Supabase')) {
      healthStatus.checks.supabase.status = 'error'
      healthStatus.checks.supabase.error = errorMessage
    } else {
      healthStatus.checks.database.status = 'error'
      healthStatus.checks.database.error = errorMessage
    }

    healthStatus.status = 'unhealthy'
    console.error('[Health Check] Error:', errorMessage)
  }

  const totalLatency = Date.now() - startTime
  console.log('[Health Check] Total check time:', totalLatency, 'ms, status:', healthStatus.status)

  // Return 503 if unhealthy, 200 otherwise
  const httpStatus = healthStatus.status === 'unhealthy' ? 503 : 200

  return new Response(
    JSON.stringify(healthStatus),
    {
      status: httpStatus,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Health-Check-Latency': String(totalLatency),
      },
    }
  )
})
