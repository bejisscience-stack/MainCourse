import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Helper function to check if user is admin using RPC function (bypasses RLS)
async function checkIsAdmin(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .rpc('check_is_admin', { user_id: userId });

    if (error) {
      console.error('[Media API] Error checking admin status:', error);
      return false;
    }

    return data === true;
  } catch (err) {
    console.error('[Media API] Exception checking admin:', err);
    return false;
  }
}

// Increase max file size to 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/mov',
];

const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

// POST /api/chats/:chatId/media - Upload media file
export async function POST(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const { chatId } = params;

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

    // Parse form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid form data' },
        { status: 400 }
      );
    }

    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` },
        { status: 400 }
      );
    }

    // Validate file type
    const mimeType = file.type.toLowerCase();
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: `Invalid file type: ${mimeType}. Only images (jpg, png, webp, gif) and videos (mp4, webm, mov) are allowed.` },
        { status: 400 }
      );
    }

    // Determine file type category
    let fileType: 'image' | 'video' | 'gif' = 'image';
    if (ALLOWED_VIDEO_TYPES.includes(mimeType)) {
      fileType = 'video';
    } else if (mimeType === 'image/gif') {
      fileType = 'gif';
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

    // Check if user is admin first (admins can access all chats for moderation)
    const isAdmin = await checkIsAdmin(supabase, user.id);

    // Get course for lecturer check
    const { data: course } = await supabase
      .from('courses')
      .select('lecturer_id')
      .eq('id', channel.course_id)
      .single();

    if (!isAdmin) {
      // Check enrollment or lecturer status for non-admins
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

      // Check if user is muted by this lecturer (lecturer-wise mute)
      // Admins cannot be muted
      const { data: mutedUser } = await supabase
        .from('muted_users')
        .select('id')
        .eq('lecturer_id', course?.lecturer_id)
        .eq('user_id', user.id)
        .single();

      if (mutedUser) {
        return NextResponse.json(
          { error: 'You have been muted and cannot upload files' },
          { status: 403 }
        );
      }
    }

    // Generate unique file name with sanitized original name
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileExt = originalName.split('.').pop()?.toLowerCase() || 'bin';
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 10);
    const fileName = `${timestamp}-${randomId}.${fileExt}`;
    const filePath = `${channel.course_id}/${chatId}/${user.id}/${fileName}`;

    // Convert file to buffer
    let buffer: Buffer;
    try {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } catch (e) {
      return NextResponse.json(
        { error: 'Failed to process file' },
        { status: 500 }
      );
    }

    // Upload to Supabase Storage with retry logic
    let uploadError: any = null;
    let uploadData: any = null;
    
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await supabase.storage
        .from('chat-media')
        .upload(filePath, buffer, {
          contentType: mimeType,
          upsert: false,
          cacheControl: '3600',
        });
      
      if (!result.error) {
        uploadData = result.data;
        uploadError = null;
        break;
      }
      
      uploadError = result.error;
      
      // If it's a duplicate file error, try with different name
      if (result.error.message?.includes('duplicate') || result.error.message?.includes('already exists')) {
        const retryFileName = `${timestamp}-${randomId}-${attempt + 1}.${fileExt}`;
        const retryPath = `${channel.course_id}/${chatId}/${user.id}/${retryFileName}`;
        
        const retryResult = await supabase.storage
          .from('chat-media')
          .upload(retryPath, buffer, {
            contentType: mimeType,
            upsert: true,
            cacheControl: '3600',
          });
        
        if (!retryResult.error) {
          uploadData = retryResult.data;
          uploadError = null;
          break;
        }
      }
      
      // Wait before retry
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }

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
      .getPublicUrl(uploadData.path || filePath);

    const fileUrl = urlData.publicUrl;

    // Validate URL was generated
    if (!fileUrl) {
      console.error('Failed to generate public URL for:', filePath);
      return NextResponse.json(
        { error: 'Failed to generate file URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      fileUrl,
      fileName: originalName,
      fileType,
      fileSize: file.size,
      mimeType: mimeType,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/chats/[chatId]/media:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
