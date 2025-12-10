import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const { courseId } = params;

    // Get auth token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify token and get user
    const { user, error: userError } = await verifyTokenAndGetUser(token);
    if (userError || !user) {
      console.error('Auth error:', userError);
      return NextResponse.json(
        { error: 'Unauthorized', details: userError?.message || 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Create Supabase client for database operations
    const supabase = createServerSupabaseClient(token);

    // Check if user is enrolled or is lecturer
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .single();

    const { data: course } = await supabase
      .from('courses')
      .select('lecturer_id')
      .eq('id', courseId)
      .single();

    const isLecturer = course?.lecturer_id === user.id;
    const isEnrolled = !!enrollment;

    if (!isEnrolled && !isLecturer) {
      return NextResponse.json(
        { error: 'Forbidden: You are not enrolled in this course' },
        { status: 403 }
      );
    }

    // Fetch channels (chats) for this course
    const { data: channels, error } = await supabase
      .from('channels')
      .select('*')
      .eq('course_id', courseId)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching channels:', error);
      return NextResponse.json(
        { error: 'Failed to fetch channels' },
        { status: 500 }
      );
    }

    return NextResponse.json({ channels: channels || [] });
  } catch (error: any) {
    console.error('Error in GET /api/courses/[courseId]/chats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
