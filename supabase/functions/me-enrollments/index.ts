import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getAuthenticatedUser } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  // Only allow GET
  if (req.method !== 'GET') {
    return errorResponse('Method not allowed', 405)
  }

  // Authenticate user
  const auth = await getAuthenticatedUser(req)
  if ('response' in auth) {
    return auth.response
  }
  const { user, supabase } = auth

  try {
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
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching enrollments:', error)
      return errorResponse('Failed to fetch enrollments', 500)
    }

    return jsonResponse({ enrollments: enrollments || [] })
  } catch (error) {
    console.error('Error in GET /me-enrollments:', error)
    return errorResponse('Internal server error', 500)
  }
})
