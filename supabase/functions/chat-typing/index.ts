import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getAuthenticatedUser, checkIsAdmin } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') return errorResponse('Method not allowed', 405)

  const auth = await getAuthenticatedUser(req)
  if ('response' in auth) return auth.response
  const { user, supabase } = auth

  try {
    const body = await req.json()
    const { chatId } = body
    if (!chatId) return errorResponse('chatId is required', 400)

    const { data: channel, error: channelError } = await supabase
      .from('channels').select('id, course_id').eq('id', chatId).single()

    if (channelError || !channel) return errorResponse('Channel not found', 404)

    const isAdmin = await checkIsAdmin(supabase, user.id)

    if (!isAdmin) {
      const { data: course } = await supabase.from('courses').select('lecturer_id').eq('id', channel.course_id).single()
      const { data: enrollment } = await supabase.from('enrollments').select('id').eq('user_id', user.id).eq('course_id', channel.course_id).single()

      if (!enrollment && course?.lecturer_id !== user.id) {
        return errorResponse('Forbidden', 403)
      }
    }

    const expiresAt = new Date(Date.now() + 3000).toISOString()
    const { error: upsertError } = await supabase
      .from('typing_indicators')
      .upsert({ channel_id: chatId, user_id: user.id, expires_at: expiresAt }, { onConflict: 'channel_id,user_id' })

    if (upsertError) return errorResponse('Failed to update typing indicator', 500)

    return jsonResponse({ success: true })
  } catch (error) {
    return errorResponse('Internal server error', 500)
  }
})
