import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getAuthenticatedUser, checkIsAdmin } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'GET' && req.method !== 'POST') return errorResponse('Method not allowed', 405)

  const auth = await getAuthenticatedUser(req)
  if ('response' in auth) return auth.response
  const { user, supabase } = auth

  // Handle POST - send message
  if (req.method === 'POST') {
    try {
      const body = await req.json()
      const { chatId, content, replyTo } = body

      if (!chatId) return errorResponse('chatId is required', 400)
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return errorResponse('Message content is required', 400)
      }

      const { data: channel, error: channelError } = await supabase
        .from('channels')
        .select('id, course_id')
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

        // Check if user is muted
        const { data: mutedUser } = await supabase
          .from('muted_users').select('id').eq('lecturer_id', course?.lecturer_id).eq('user_id', user.id).single()
        if (mutedUser) return errorResponse('You have been muted and cannot send messages', 403)
      }

      // Insert message
      const { data: message, error: insertError } = await supabase
        .from('messages')
        .insert({
          channel_id: chatId,
          course_id: channel.course_id,
          user_id: user.id,
          content: content.trim(),
          reply_to_id: replyTo || null,
        })
        .select('id, content, user_id, reply_to_id, edited_at, created_at')
        .single()

      if (insertError) return errorResponse('Failed to send message', 500)

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles').select('id, username').eq('id', user.id).single()

      // Get reply preview if replying
      let replyPreview = undefined
      if (replyTo) {
        const { data: replyMessage } = await supabase
          .from('messages').select('id, content, user_id').eq('id', replyTo).single()

        if (replyMessage) {
          const { data: replyProfile } = await supabase
            .from('profiles').select('username').eq('id', replyMessage.user_id).single()
          replyPreview = {
            id: replyMessage.id,
            username: replyProfile?.username || 'User',
            content: replyMessage.content.length > 100 ? replyMessage.content.substring(0, 100) + '...' : replyMessage.content,
          }
        }
      }

      const formattedMessage = {
        id: message.id,
        user: { id: message.user_id, username: profile?.username || 'User', avatarUrl: '' },
        content: message.content,
        timestamp: new Date(message.created_at).getTime(),
        edited: false,
        replyTo: message.reply_to_id || undefined,
        replyPreview,
        reactions: [],
      }

      return jsonResponse({ message: formattedMessage }, 201)
    } catch (error) {
      console.error('Error:', error)
      return errorResponse('Internal server error', 500)
    }
  }

  // Handle GET - fetch messages
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
