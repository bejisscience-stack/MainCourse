import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getAuthenticatedUser, checkIsAdmin } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'GET') return errorResponse('Method not allowed', 405)

  const auth = await getAuthenticatedUser(req)
  if ('response' in auth) return auth.response
  const { user, supabase } = auth

  const url = new URL(req.url)
  const chatId = url.searchParams.get('chatId')
  if (!chatId) return errorResponse('chatId query parameter is required', 400)

  try {
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('id, course_id, name, type')
      .eq('id', chatId)
      .single()

    if (channelError || !channel) return errorResponse('Channel not found', 404)

    const isAdmin = await checkIsAdmin(supabase, user.id)

    if (!isAdmin) {
      const { data: enrollment } = await supabase
        .from('enrollments').select('id').eq('user_id', user.id).eq('course_id', channel.course_id).single()

      const { data: course } = await supabase
        .from('courses').select('lecturer_id').eq('id', channel.course_id).single()

      if (!enrollment && course?.lecturer_id !== user.id) {
        return errorResponse('Forbidden: You do not have access to this channel', 403)
      }
    }

    const before = url.searchParams.get('before')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100)

    let query = supabase
      .from('messages')
      .select('id, content, user_id, reply_to_id, edited_at, created_at, channel_id, course_id')
      .eq('channel_id', chatId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (before) query = query.lt('created_at', before)

    const { data: messages, error: messagesError } = await query
    if (messagesError) return errorResponse('Failed to fetch messages', 500)
    if (!messages || messages.length === 0) return jsonResponse({ messages: [] })

    const userIds = [...new Set(messages.map(m => m.user_id))]
    const replyIds = messages.filter(m => m.reply_to_id).map(m => m.reply_to_id)
    const messageIds = messages.map(m => m.id)

    const [profilesResult, replyMessagesResult, attachmentsResult] = await Promise.all([
      supabase.from('profiles').select('id, username, email').in('id', userIds),
      replyIds.length > 0 ? supabase.from('messages').select('id, content, user_id').in('id', replyIds) : Promise.resolve({ data: null }),
      supabase.from('message_attachments').select('id, message_id, file_url, file_name, file_type, file_size, mime_type').in('message_id', messageIds),
    ])

    const profileMap = new Map(profilesResult.data?.map(p => [p.id, p]) || [])
    const replyMap = new Map()

    if (replyMessagesResult.data?.length) {
      const replyUserIds = [...new Set(replyMessagesResult.data.map(m => m.user_id))]
      const { data: replyProfiles } = await supabase.from('profiles').select('id, username').in('id', replyUserIds)
      const replyProfileMap = new Map(replyProfiles?.map(p => [p.id, p]) || [])

      for (const reply of replyMessagesResult.data) {
        const replyProfile = replyProfileMap.get(reply.user_id)
        replyMap.set(reply.id, {
          id: reply.id,
          username: replyProfile?.username || 'User',
          content: reply.content.length > 100 ? reply.content.substring(0, 100) + '...' : reply.content,
        })
      }
    }

    const attachmentMap = new Map()
    if (attachmentsResult.data) {
      for (const att of attachmentsResult.data) {
        if (!attachmentMap.has(att.message_id)) attachmentMap.set(att.message_id, [])
        attachmentMap.get(att.message_id).push({
          id: att.id, fileUrl: att.file_url, fileName: att.file_name,
          fileType: att.file_type, fileSize: att.file_size, mimeType: att.mime_type,
        })
      }
    }

    const formattedMessages = messages.map(msg => {
      const profile = profileMap.get(msg.user_id)
      return {
        id: msg.id,
        user: { id: msg.user_id, username: profile?.username || 'User', avatarUrl: '' },
        content: msg.content,
        timestamp: new Date(msg.created_at).getTime(),
        edited: !!msg.edited_at,
        replyTo: msg.reply_to_id || undefined,
        replyPreview: msg.reply_to_id ? replyMap.get(msg.reply_to_id) : undefined,
        attachments: attachmentMap.get(msg.id),
        reactions: [],
      }
    })

    formattedMessages.reverse()
    return jsonResponse({ messages: formattedMessages })
  } catch (error) {
    console.error('Error:', error)
    return errorResponse('Internal server error', 500)
  }
})
