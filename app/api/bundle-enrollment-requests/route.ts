import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// POST: Create a new bundle enrollment request
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { user, error: userError } = await verifyTokenAndGetUser(token);
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: userError?.message },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { bundleId, paymentScreenshots } = body;

    if (!bundleId) {
      return NextResponse.json(
        { error: 'bundleId is required' },
        { status: 400 }
      );
    }

    // Validate paymentScreenshots if provided
    if (paymentScreenshots && !Array.isArray(paymentScreenshots)) {
      return NextResponse.json(
        { error: 'paymentScreenshots must be an array' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient(token);

    // Check if user already has a pending request
    const { data: existingRequest, error: requestCheckError } = await supabase
      .from('bundle_enrollment_requests')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('bundle_id', bundleId)
      .eq('status', 'pending')
      .maybeSingle();

    if (requestCheckError && requestCheckError.code !== 'PGRST116') {
      console.error('Error checking existing request:', requestCheckError);
      return NextResponse.json(
        { error: 'Failed to verify bundle enrollment request status', details: requestCheckError.message },
        { status: 500 }
      );
    }

    if (existingRequest) {
      return NextResponse.json(
        { error: 'You already have a pending bundle enrollment request' },
        { status: 400 }
      );
    }

    // Check if user is already enrolled
    const { data: existingEnrollment, error: enrollmentCheckError } = await supabase
      .from('bundle_enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('bundle_id', bundleId)
      .maybeSingle();

    if (enrollmentCheckError && enrollmentCheckError.code !== 'PGRST116') {
      console.error('Error checking existing enrollment:', enrollmentCheckError);
      return NextResponse.json(
        { error: 'Failed to verify bundle enrollment status', details: enrollmentCheckError.message },
        { status: 500 }
      );
    }

    if (existingEnrollment) {
      return NextResponse.json(
        { error: 'You are already enrolled in this bundle' },
        { status: 400 }
      );
    }

    // Verify bundle exists and is active
    const { data: bundle, error: bundleError } = await supabase
      .from('course_bundles')
      .select('id, is_active')
      .eq('id', bundleId)
      .eq('is_active', true)
      .maybeSingle();

    if (bundleError) {
      console.error('Error checking bundle:', bundleError);
      return NextResponse.json(
        { error: 'Failed to verify bundle', details: bundleError.message },
        { status: 500 }
      );
    }

    if (!bundle) {
      return NextResponse.json(
        { error: 'Bundle not found or is not active' },
        { status: 404 }
      );
    }

    // Format payment screenshots as JSONB array
    const formattedScreenshots = Array.isArray(paymentScreenshots) 
      ? paymentScreenshots 
      : paymentScreenshots 
        ? [paymentScreenshots] 
        : [];

    // Create bundle enrollment request
    const { data: enrollmentRequest, error: insertError } = await supabase
      .from('bundle_enrollment_requests')
      .insert({
        user_id: user.id,
        bundle_id: bundleId,
        status: 'pending',
        payment_screenshots: formattedScreenshots.length > 0 ? formattedScreenshots : [],
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating bundle enrollment request:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        userId: user.id,
        bundleId: bundleId,
      });
      
      // Check for specific error codes
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'You already have a bundle enrollment request for this bundle', details: insertError.message },
          { status: 400 }
        );
      }
      
      if (insertError.code === '23503') {
        return NextResponse.json(
          { error: 'Invalid bundle or user', details: insertError.message },
          { status: 400 }
        );
      }
      
      if (insertError.code === '42501') {
        return NextResponse.json(
          { error: 'Permission denied. Please ensure you are logged in correctly.', details: insertError.message },
          { status: 403 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to create bundle enrollment request', 
          details: insertError.message || 'Unknown database error',
          code: insertError.code
        },
        { status: 500 }
      );
    }

    if (!enrollmentRequest) {
      return NextResponse.json(
        { error: 'Failed to create bundle enrollment request - no data returned' },
        { status: 500 }
      );
    }

    return NextResponse.json({ request: enrollmentRequest }, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/bundle-enrollment-requests:', error);
    
    let errorMessage = 'Internal server error';
    if (error.message) {
      errorMessage = error.message;
    } else if (error.error) {
      errorMessage = error.error;
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error.details || error.stack || 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}


