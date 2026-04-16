import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getAuthenticatedUser, checkIsAdmin } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'GET') {
    return errorResponse('Method not allowed', 405)
  }

  const auth = await getAuthenticatedUser(req)
  if ('response' in auth) return auth.response
  const { user, supabase } = auth

  const url = new URL(req.url)
  const courseId = url.searchParams.get('courseId')

  if (!courseId) {
    return errorResponse('courseId query parameter is required', 400)
  }

  try {
    const isAdmin = await checkIsAdmin(supabase, user.id)

    if (!isAdmin) {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .single()

      const { data: course } = await supabase
        .from('courses')
        .select('lecturer_id')
        .eq('id', courseId)
        .single()

      const isLecturer = course?.lecturer_id === user.id
      const isEnrolled = !!enrollment

      if (!isEnrolled && !isLecturer) {
        return errorResponse('Forbidden: You are not enrolled in this course', 403)
      }
    }

    const { data: channels, error } = await supabase
      .from('channels')
      .select('*')
      .eq('course_id', courseId)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('Error fetching channels:', error)
      return errorResponse('Failed to fetch channels', 500)
    }

    return jsonResponse({ channels: channels || [] })
  } catch (error) {
    console.error('Error in GET /course-chats:', error)
    return errorResponse('Internal server error', 500)
  }
})
