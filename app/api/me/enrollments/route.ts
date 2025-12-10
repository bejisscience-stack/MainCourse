import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
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

    // Fetch enrollments with course details
    const { data: enrollments, error } = await supabase
      .from('enrollments')
      .select(`
        id,
        course_id,
        created_at,
        courses (
          id,
          title,
          description,
          course_type,
          price,
          thumbnail_url
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching enrollments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch enrollments' },
        { status: 500 }
      );
    }

    return NextResponse.json({ enrollments: enrollments || [] });
  } catch (error: any) {
    console.error('Error in GET /api/me/enrollments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
