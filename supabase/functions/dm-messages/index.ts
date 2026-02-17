import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getAuthenticatedUser } from '../_shared/auth.ts'

/**
 * Resolve a conversation ID from either a direct conversationId or a friendId.
 * When friendId is provided, validates friendship and finds or creates the conversation.
 * Uses canonical ordering (smaller UUID = user1_id) to match the CHECK constraint.
 */
async function resolveConversation(
  supabase: ReturnType<typeof import('../_shared/supabase.ts').createServerSupabaseClient>,
  userId: string,
  conversationId?: string,
  friendId?: string,
): Promise<{ id: string } | { error: string; status: number }> {
  // Case 1: conversationId provided — verify participation
  if (conversationId) {
    const { data: conversation, error } = await supabase
      .from('dm_conversations')
      .select('id, user1_id, user2_id')
      .eq('id', conversationId)
      .single()

    if (error || !conversation) return { error: 'Conversation not found', status: 404 }
    if (conversation.user1_id !== userId && conversation.user2_id !== userId) {
      return { error: 'Forbidden: You are not a participant in this conversation', status: 403 }
    }
    return { id: conversation.id }
  }

  // Case 2: friendId provided — verify friendship, then find or create conversation
  if (friendId) {
    if (friendId === userId) return { error: 'Cannot start a conversation with yourself', status: 400 }

    // Canonical ordering for friendship/conversation lookup
    const u1 = userId < friendId ? userId : friendId
    const u2 = userId < friendId ? friendId : userId

    // Verify friendship exists
    const { data: friendship } = await supabase
      .from('friendships')
      .select('id')
      .eq('user1_id', u1)
      .eq('user2_id', u2)
      .single()

    if (!friendship) return { error: 'You must be friends to start a conversation', status: 403 }

    // Find existing conversation
    const { data: existing } = await supabase
      .from('dm_conversations')
      .select('id')
      .eq('user1_id', u1)
      .eq('user2_id', u2)
      .single()

    if (existing) return { id: existing.id }

    // Create new conversation (RLS will also enforce friendship check)
    const { data: created, error: createError } = await supabase
      .from('dm_conversations')
      .insert({ user1_id: u1, user2_id: u2 })
      .select('id')
      .single()

    if (createError || !created) {
      return { error: 'Failed to create conversation. Are you friends with this user?', status: 403 }
    }
    return { id: created.id }
  }

  return { error: 'Either conversationId or friendId is required', status: 400 }
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'GET' && req.method !== 'POST') return errorResponse('Method not allowed', 405)

  const auth = await getAuthenticatedUser(req)
  if ('response' in auth) return auth.response
  const { user, supabase } = auth

  // Handle POST - send DM message
  if (req.method === 'POST') {
    try {
      const body = await req.json()
      const { conversationId, friendId, content, replyTo } = body

      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return errorResponse('Message content is required', 400)
      }
      if (content.trim().length > 4000) {
        return errorResponse('Message content must be 4000 characters or less', 400)
      }

      // Resolve conversation (existing or create via friendId)
      const resolved = await resolveConversation(supabase, user.id, conversationId, friendId)
      if ('error' in resolved) return errorResponse(resolved.error, resolved.status)
      const resolvedConversationId = resolved.id

      // Insert message
      const { data: message, error: insertError } = await supabase
        .from('dm_messages')
        .insert({
          conversation_id: resolvedConversationId,
          user_id: user.id,
          content: content.trim(),
          reply_to_id: replyTo || null,
        })
        .select('id, content, user_id, reply_to_id, edited_at, created_at')
        .single()

      if (insertError) return errorResponse('Failed to send message', 500)

      // Get sender profile
      const { data: profile } = await supabase
        .from('profiles').select('id, username').eq('id', user.id).single()

      // Get reply preview if replying
      let replyPreview = undefined
      if (replyTo) {
        const { data: replyMessage } = await supabase
          .from('dm_messages').select('id, content, user_id').eq('id', replyTo).single()

        if (replyMessage) {
          const { data: replyProfile } = await supabase
            .from('profiles').select('username').eq('id', replyMessage.user_id).single()
          replyPreview = {
            id: replyMessage.id,
            username: replyProfile?.username || 'User',
            content: replyMessage.content.length > 100
              ? replyMessage.content.substring(0, 100) + '...'
              : replyMessage.content,
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

      return jsonResponse({ message: formattedMessage, conversationId: resolvedConversationId }, 201)
    } catch (error) {
      console.error('Error:', error)
      return errorResponse('Internal server error', 500)
    }
  }

  // Handle GET - fetch paginated DM messages
  const url = new URL(req.url)
  const conversationId = url.searchParams.get('conversationId')
  if (!conversationId) return errorResponse('conversationId query parameter is required', 400)

  try {
    // Verify user is a participant (RLS handles this too, but explicit check gives better errors)
    const { data: conversation, error: convError } = await supabase
      .from('dm_conversations')
      .select('id, user1_id, user2_id')
      .eq('id', conversationId)
      .single()

    if (convError || !conversation) return errorResponse('Conversation not found', 404)

    if (conversation.user1_id !== user.id && conversation.user2_id !== user.id) {
      return errorResponse('Forbidden: You are not a participant in this conversation', 403)
    }

    const before = url.searchParams.get('before')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100)

    let query = supabase
      .from('dm_messages')
      .select('id, content, user_id, reply_to_id, edited_at, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (before) query = query.lt('created_at', before)

    const { data: messages, error: messagesError } = await query
    if (messagesError) return errorResponse('Failed to fetch messages', 500)
    if (!messages || messages.length === 0) return jsonResponse({ messages: [] })

    // Batch-fetch profiles and reply previews
    const userIds = [...new Set(messages.map(m => m.user_id))]
    const replyIds = messages.filter(m => m.reply_to_id).map(m => m.reply_to_id)

    const [profilesResult, replyMessagesResult] = await Promise.all([
      supabase.from('profiles').select('id, username').in('id', userIds),
      replyIds.length > 0
        ? supabase.from('dm_messages').select('id, content, user_id').in('id', replyIds)
        : Promise.resolve({ data: null }),
    ])

    const profileMap = new Map(profilesResult.data?.map(p => [p.id, p]) || [])
    const replyMap = new Map()

    if (replyMessagesResult.data?.length) {
      const replyUserIds = [...new Set(replyMessagesResult.data.map(m => m.user_id))]
      const { data: replyProfiles } = await supabase
        .from('profiles').select('id, username').in('id', replyUserIds)
      const replyProfileMap = new Map(replyProfiles?.map(p => [p.id, p]) || [])

      for (const reply of replyMessagesResult.data) {
        const replyProfile = replyProfileMap.get(reply.user_id)
        replyMap.set(reply.id, {
          id: reply.id,
          username: replyProfile?.username || 'User',
          content: reply.content.length > 100
            ? reply.content.substring(0, 100) + '...'
            : reply.content,
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
        reactions: [],
      }
    })

    // Return in chronological order (oldest first)
    formattedMessages.reverse()
    return jsonResponse({ messages: formattedMessages })
  } catch (error) {
    console.error('Error:', error)
    return errorResponse('Internal server error', 500)
  }
})
