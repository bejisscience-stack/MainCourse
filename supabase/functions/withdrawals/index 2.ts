import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getAuthenticatedUser } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  // Only allow GET and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  // Authenticate user
  const auth = await getAuthenticatedUser(req)
  if ('response' in auth) {
    return auth.response
  }
  const { user, supabase } = auth

  if (req.method === 'GET') {
    return handleGet(supabase, user.id)
  } else {
    return handlePost(req, supabase)
  }
})

async function handleGet(
  supabase: ReturnType<typeof import('../_shared/supabase.ts').createServerSupabaseClient>,
  userId: string
) {
  try {
    const { data: requests, error } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching withdrawal requests:', error)
      return errorResponse('Failed to fetch withdrawal requests', 500)
    }

    return jsonResponse({ requests: requests || [] })
  } catch (error) {
    console.error('Error in GET /withdrawals:', error)
    return errorResponse('Internal server error', 500)
  }
}

async function handlePost(
  req: Request,
  supabase: ReturnType<typeof import('../_shared/supabase.ts').createServerSupabaseClient>
) {
  try {
    const body = await req.json()
    const { amount, bankAccountNumber } = body

    // Validate amount
    if (!amount || typeof amount !== 'number' || amount < 20) {
      return errorResponse('Minimum withdrawal amount is 20 GEL', 400)
    }

    // Validate bank account
    if (!bankAccountNumber || typeof bankAccountNumber !== 'string' || bankAccountNumber.trim().length < 10) {
      return errorResponse('Valid bank account number is required', 400)
    }

    // Call the RPC function to create withdrawal request
    // This RPC validates user has sufficient balance
    const { data: requestId, error: rpcError } = await supabase
      .rpc('create_withdrawal_request', {
        p_amount: amount,
        p_bank_account_number: bankAccountNumber.trim(),
      })

    if (rpcError) {
      console.error('Error creating withdrawal request:', rpcError)
      return jsonResponse(
        { error: rpcError.message || 'Failed to create withdrawal request' },
        400
      )
    }

    // Fetch the created request
    const { data: withdrawalRequest, error: fetchError } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (fetchError || !withdrawalRequest) {
      console.error('Error fetching created request:', fetchError)
      return errorResponse('Failed to create withdrawal request', 500)
    }

    return jsonResponse(
      {
        success: true,
        request: withdrawalRequest,
      },
      201
    )
  } catch (error) {
    console.error('Error in POST /withdrawals:', error)
    return errorResponse('Internal server error', 500)
  }
}
