import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getAuthenticatedUser } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST' && req.method !== 'GET' && req.method !== 'DELETE') {
    return errorResponse('Method not allowed', 405)
  }

  const auth = await getAuthenticatedUser(req)
  if ('response' in auth) return auth.response
  const { user, supabase } = auth

  const url = new URL(req.url)

  // GET - Check if user is muted
  if (req.method === 'GET') {
    const chatId = url.searchParams.get('chatId')
    const userId = url.searchParams.get('userId')

    if (!chatId) return errorResponse('chatId is required', 400)
    if (!userId) return errorResponse('userId is required', 400)

    try {
      const { data: channel, error: channelError } = await supabase
        .from('channels').select('id, course_id').eq('id', chatId).single()
      if (channelError || !channel) return errorResponse('Channel not found', 404)

      const { data: course } = await supabase
        .from('courses').select('lecturer_id').eq('id', channel.course_id).single()

      if (!course?.lecturer_id) return jsonResponse({ muted: false })

      const { data: mutedRecord } = await supabase
        .from('muted_users')
        .select('id')
        .eq('lecturer_id', course.lecturer_id)
        .eq('user_id', userId)
        .single()

      return jsonResponse({ muted: !!mutedRecord })
    } catch (error) {
      console.error('Error:', error)
      return errorResponse('Internal server error', 500)
    }
  }

  // DELETE - Unmute user
  if (req.method === 'DELETE') {
    const chatId = url.searchParams.get('chatId')
    const userId = url.searchParams.get('userId')

    if (!chatId) return errorResponse('chatId is required', 400)
    if (!userId) return errorResponse('userId is required', 400)

    try {
      const { data: channel, error: channelError } = await supabase
        .from('channels').select('id, course_id').eq('id', chatId).single()
      if (channelError || !channel) return errorResponse('Channel not found', 404)

      const { data: course } = await supabase
        .from('courses').select('lecturer_id').eq('id', channel.course_id).single()
      if (!course) return errorResponse('Course not found', 404)
      if (course.lecturer_id !== user.id) return errorResponse('Forbidden: Only lecturers can unmute users', 403)

      const { error: unmuteError } = await supabase
        .from('muted_users').delete().eq('lecturer_id', user.id).eq('user_id', userId)

      if (unmuteError) return jsonResponse({ error: 'Failed to unmute user', details: unmuteError.message }, 500)

      return jsonResponse({ muted: false, message: 'User has been unmuted' })
    } catch (error) {
      console.error('Error:', error)
      return errorResponse('Internal server error', 500)
    }
  }

  // POST - Mute/unmute user
  try {
    const body = await req.json()
    const { chatId, muted, userId } = body

    if (!chatId) return errorResponse('chatId is required', 400)
    if (typeof muted !== 'boolean') return errorResponse('muted (boolean) is required', 400)

    const { data: channel, error: channelError } = await supabase
      .from('channels').select('id, course_id').eq('id', chatId).single()
    if (channelError || !channel) return errorResponse('Channel not found', 404)

    const { data: course, error: courseError } = await supabase
      .from('courses').select('lecturer_id').eq('id', channel.course_id).single()
    if (courseError || !course) return errorResponse('Course not found', 404)

    if (course.lecturer_id !== user.id) return errorResponse('Forbidden: Only lecturers can mute users', 403)
    if (!userId) return errorResponse('userId is required to mute/unmute a user', 400)
    if (userId === user.id) return errorResponse('Cannot mute yourself', 400)

    if (muted) {
      const { data: mutedUser, error: muteError } = await supabase
        .from('muted_users')
        .insert({ lecturer_id: user.id, user_id: userId, muted_by: user.id, channel_id: chatId, course_id: channel.course_id })
        .select().single()

      if (muteError) {
        if (muteError.code === '23505') return jsonResponse({ error: 'User is already muted' }, 409)
        return jsonResponse({ error: 'Failed to mute user', details: muteError.message }, 500)
      }
      return jsonResponse({ muted: true, mutedUser, message: 'User has been muted' }, 201)
    } else {
      const { error: unmuteError } = await supabase
        .from('muted_users').delete().eq('lecturer_id', user.id).eq('user_id', userId)
      if (unmuteError) return jsonResponse({ error: 'Failed to unmute user', details: unmuteError.message }, 500)
      return jsonResponse({ muted: false, message: 'User has been unmuted' })
    }
  } catch (error) {
    return errorResponse('Internal server error', 500)
  }
})
