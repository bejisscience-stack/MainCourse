import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: {
      status: 'ok' | 'error';
      latency?: number;
      error?: string;
    };
    supabase: {
      status: 'ok' | 'error';
      error?: string;
    };
  };
}

export async function GET() {
  const startTime = Date.now();
  const healthStatus: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: 'ok' },
      supabase: { status: 'ok' },
    },
  };

  // Check database connectivity
  try {
    const supabase = createServiceRoleClient();
    const dbStartTime = Date.now();

    // Simple query to verify database is responsive
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    const dbLatency = Date.now() - dbStartTime;
    healthStatus.checks.database.latency = dbLatency;

    if (error) {
      healthStatus.checks.database.status = 'error';
      healthStatus.checks.database.error = error.message;
      healthStatus.status = 'degraded';
      console.error('[Health Check] Database error:', error.message);
    } else {
      console.log('[Health Check] Database OK, latency:', dbLatency, 'ms');
    }
  } catch (err: any) {
    healthStatus.checks.database.status = 'error';
    healthStatus.checks.database.error = err.message || 'Database connection failed';
    healthStatus.status = 'unhealthy';
    console.error('[Health Check] Database exception:', err);
  }

  // Check Supabase service role client initialization
  try {
    const supabase = createServiceRoleClient();
    if (!supabase) {
      throw new Error('Failed to create Supabase client');
    }
    healthStatus.checks.supabase.status = 'ok';
  } catch (err: any) {
    healthStatus.checks.supabase.status = 'error';
    healthStatus.checks.supabase.error = err.message || 'Supabase client initialization failed';
    healthStatus.status = 'unhealthy';
    console.error('[Health Check] Supabase client error:', err);
  }

  const totalLatency = Date.now() - startTime;
  console.log('[Health Check] Total check time:', totalLatency, 'ms, status:', healthStatus.status);

  const httpStatus = healthStatus.status === 'healthy' ? 200 :
                     healthStatus.status === 'degraded' ? 200 : 503;

  return NextResponse.json(healthStatus, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Health-Check-Latency': String(totalLatency),
    },
  });
}
