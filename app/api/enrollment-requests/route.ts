import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET: Fetch enrollment requests for the current user
export async function GET(request: NextRequest) {
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

    const supabase = createServerSupabaseClient(token);

    const { data: requests, error } = await supabase
      .from('enrollment_requests')
      .select(`
        id,
        course_id,
        status,
        created_at,
        updated_at,
        courses (
          id,
          title,
          thumbnail_url
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching enrollment requests:', error);
      return NextResponse.json(
        { error: 'Failed to fetch enrollment requests' },
        { status: 500 }
      );
    }

    return NextResponse.json({ requests: requests || [] });
  } catch (error: any) {
    console.error('Error in GET /api/enrollment-requests:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Create a new enrollment request
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
    const { courseId, paymentScreenshots } = body;

    if (!courseId) {
      return NextResponse.json(
        { error: 'courseId is required' },
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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/695db6a1-160d-40d0-ab86-4058ba2ea89b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'enrollment-requests/route.ts:106',message:'Checking existing request',data:{userId:user.id,courseId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B1'})}).catch(()=>{});
    // #endregion
    // Check if user already has a pending request (use maybeSingle to handle no rows gracefully)
    const { data: existingRequest, error: requestCheckError } = await supabase
      .from('enrollment_requests')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .eq('status', 'pending')
      .maybeSingle();

    if (requestCheckError && requestCheckError.code !== 'PGRST116') {
      console.error('Error checking existing request:', requestCheckError);
      return NextResponse.json(
        { error: 'Failed to verify enrollment request status', details: requestCheckError.message },
        { status: 500 }
      );
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/695db6a1-160d-40d0-ab86-4058ba2ea89b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'enrollment-requests/route.ts:122',message:'Existing request check result',data:{hasExisting:!!existingRequest,requestId:existingRequest?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B1'})}).catch(()=>{});
    // #endregion
    if (existingRequest) {
      return NextResponse.json(
        { error: 'You already have a pending enrollment request for this course' },
        { status: 400 }
      );
    }

    // Check if user is already enrolled (use maybeSingle to handle no rows gracefully)
    const { data: existingEnrollment, error: enrollmentCheckError } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle();

    if (enrollmentCheckError && enrollmentCheckError.code !== 'PGRST116') {
      console.error('Error checking existing enrollment:', enrollmentCheckError);
      return NextResponse.json(
        { error: 'Failed to verify enrollment status', details: enrollmentCheckError.message },
        { status: 500 }
      );
    }

    if (existingEnrollment) {
      return NextResponse.json(
        { error: 'You are already enrolled in this course' },
        { status: 400 }
      );
    }

    // Verify course exists (use maybeSingle to handle no rows gracefully)
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .maybeSingle();

    if (courseError) {
      console.error('Error checking course:', courseError);
      return NextResponse.json(
        { error: 'Failed to verify course', details: courseError.message },
        { status: 500 }
      );
    }

    if (!course) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      );
    }

    // Format payment screenshots as JSONB array
    const formattedScreenshots = Array.isArray(paymentScreenshots) 
      ? paymentScreenshots 
      : paymentScreenshots 
        ? [paymentScreenshots] 
        : [];

    // Create enrollment request
    const { data: enrollmentRequest, error: insertError } = await supabase
      .from('enrollment_requests')
      .insert({
        user_id: user.id,
        course_id: courseId,
        status: 'pending',
        payment_screenshots: formattedScreenshots.length > 0 ? formattedScreenshots : [],
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating enrollment request:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        userId: user.id,
        courseId: courseId,
      });
      
      // Check for specific error codes
      if (insertError.code === '23505') {
        // Unique constraint violation - likely duplicate request
        return NextResponse.json(
          { error: 'You already have an enrollment request for this course', details: insertError.message },
          { status: 400 }
        );
      }
      
      if (insertError.code === '23503') {
        // Foreign key violation - course or user doesn't exist
        return NextResponse.json(
          { error: 'Invalid course or user', details: insertError.message },
          { status: 400 }
        );
      }
      
      if (insertError.code === '42501') {
        // Insufficient privilege - RLS policy issue
        return NextResponse.json(
          { error: 'Permission denied. Please ensure you are logged in correctly.', details: insertError.message },
          { status: 403 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to create enrollment request', 
          details: insertError.message || 'Unknown database error',
          code: insertError.code
        },
        { status: 500 }
      );
    }

    if (!enrollmentRequest) {
      return NextResponse.json(
        { error: 'Failed to create enrollment request - no data returned' },
        { status: 500 }
      );
    }

    return NextResponse.json({ request: enrollmentRequest }, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/enrollment-requests:', error);
    
    // Provide more specific error messages
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

