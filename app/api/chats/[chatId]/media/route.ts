import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// POST /api/chats/:chatId/media - Upload media file
export async function POST(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const { chatId } = params;
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
    const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only images and videos are allowed.' },
        { status: 400 }
      );
    }

    // Determine file type category
    let fileType: 'image' | 'video' | 'gif' = 'image';
    if (allowedVideoTypes.includes(file.type)) {
      fileType = 'video';
    } else if (file.type === 'image/gif') {
      fileType = 'gif';
    }

    // Get auth token
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
        { error: 'Unauthorized', details: userError?.message || 'Invalid token' },
        { status: 401 }
      );
    }

    const supabase = createServerSupabaseClient(token);

    // Get channel and verify access
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('id, course_id')
      .eq('id', chatId)
      .single();

    if (channelError || !channel) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    // Check enrollment or lecturer status
    const { data: course } = await supabase
      .from('courses')
      .select('lecturer_id')
      .eq('id', channel.course_id)
      .single();

    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', channel.course_id)
      .single();

    const isLecturer = course?.lecturer_id === user.id;
    const isEnrolled = !!enrollment;

    if (!isEnrolled && !isLecturer) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have access to this channel' },
        { status: 403 }
      );
    }

    // Generate unique file name
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${chatId}/${user.id}/${fileName}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('chat-media')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file', details: uploadError.message },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('chat-media')
      .getPublicUrl(filePath);

    const fileUrl = urlData.publicUrl;

    return NextResponse.json({
      fileUrl,
      fileName: file.name,
      fileType,
      fileSize: file.size,
      mimeType: file.type,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/chats/[chatId]/media:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}


