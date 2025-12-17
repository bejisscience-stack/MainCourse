import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';
import { normalizeProfileUsername } from '@/lib/username';

export const dynamic = 'force-dynamic';

// GET /api/friends/requests - Get pending friend requests (sent and received)
export async function GET(request: NextRequest) {
  console.log('=== FRIEND REQUESTS API CALLED ===');
  console.log('Request URL:', request.url);
  console.log('Request headers:', Object.fromEntries(request.headers.entries()));
  
  try {
    // Get auth token
    const authHeader = request.headers.get('authorization');
    console.log('Auth header present:', !!authHeader);
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
    
    // Verify auth context is set correctly
    // The Authorization header in createServerSupabaseClient should set auth.uid() for RLS
    console.log('API: Current user ID from token:', user.id);
    console.log('API: Supabase client created with token');
    
    // Test: Verify we can get the user from the client (confirms auth context)
    const { data: clientUser, error: clientUserError } = await supabase.auth.getUser();
    console.log('API: Client user verification:', {
      userId: clientUser?.user?.id,
      email: clientUser?.user?.email,
      matches: clientUser?.user?.id === user.id,
      error: clientUserError,
    });
    
    // Test RLS by querying friend_requests with a direct filter to see if auth.uid() works
    // This will help us understand if RLS is blocking the query
    const { data: rlsTest, error: rlsTestError } = await supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
    
    console.log('RLS Test - Direct query with OR filter:', {
      count: rlsTest?.length || 0,
      data: rlsTest,
      error: rlsTestError,
      userId: user.id,
    });
    
    // Test RLS by trying to fetch current user's own profile first
    const { data: ownProfile, error: ownProfileError } = await supabase
      .from('profiles')
      .select('id, username, email')
      .eq('id', user.id)
      .single();
    
    console.log('RLS Test - Own profile fetch:', {
      success: !!ownProfile && !ownProfileError,
      profile: ownProfile,
      error: ownProfileError,
      userId: user.id,
    });
    
    if (ownProfileError) {
      console.error('CRITICAL: Cannot fetch own profile! RLS might be blocking:', ownProfileError);
      console.error('Error details:', {
        code: ownProfileError.code,
        message: ownProfileError.message,
        details: ownProfileError.details,
        hint: ownProfileError.hint,
      });
    }
    
    // Test: Try fetching a profile that should be accessible (one of the friend request users)
    // This will help us understand if RLS is working for other users
    if (ownProfile && !ownProfileError) {
      console.log('✅ RLS is working - can fetch own profile');
    } else {
      console.error('❌ RLS is NOT working - cannot fetch own profile');
    }

    // Debug: Test RLS by checking if we can see any friend requests at all
    console.log('=== FRIEND REQUESTS API DEBUG ===');
    console.log('Current user ID:', user.id);
    console.log('User email:', user.email);
    
    // First, test if we can query friend_requests at all (without filters)
    const { data: allRequestsTest, error: allRequestsError } = await supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status, created_at')
      .limit(10);
    
    console.log('All friend requests (RLS test):', {
      count: allRequestsTest?.length || 0,
      data: allRequestsTest,
      error: allRequestsError,
    });

    // Get pending friend requests where user is sender or receiver
    // Use a single query with OR filter - this works better with RLS
    // RLS policy allows: auth.uid() = sender_id OR auth.uid() = receiver_id
    const { data: allFriendRequests, error: requestsError } = await supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status, created_at')
      .eq('status', 'pending')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    console.log('Raw friend requests from DB:', {
      allRequests: allFriendRequests,
      total: (allFriendRequests || []).length,
      currentUserId: user.id,
      error: requestsError
    });
    
    if (requestsError) {
      console.error('Error fetching friend requests:', requestsError);
      console.error('Error details:', {
        code: requestsError.code,
        message: requestsError.message,
        details: requestsError.details,
        hint: requestsError.hint,
      });
      return NextResponse.json(
        { error: 'Failed to fetch friend requests', details: requestsError.message },
        { status: 500 }
      );
    }

    // Separate sent and received requests
    const sentRequests = (allFriendRequests || []).filter(r => r.sender_id === user.id);
    const receivedRequests = (allFriendRequests || []).filter(r => r.receiver_id === user.id);

    // Get user profiles for sent requests (receivers)
    // Use EXACT same pattern as messages route
    const sentReceiverIds = sentRequests.map(r => r.receiver_id);
    let sentReceivers: any[] = [];
    if (sentReceiverIds.length > 0) {
      console.log('=== FETCHING SENT RECEIVER PROFILES ===');
      console.log('Receiver IDs to fetch:', sentReceiverIds);
      
      // Fetch profiles - Try using RPC function first (bypasses RLS issues)
      // If that fails, fall back to direct query
      let profiles: any[] | null = null;
      let profilesError: any = null;
      
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_profiles_for_friend_requests', {
          user_ids: sentReceiverIds
        });
        
        if (rpcData && !rpcError) {
          console.log('✅ RPC function successful for sent receivers:', rpcData);
          profiles = rpcData;
        } else {
          console.warn('⚠️ RPC function failed for sent receivers, trying direct query:', rpcError);
          // Fall back to direct query
          const directResult = await supabase
            .from('profiles')
            .select('id, username, email')
            .in('id', sentReceiverIds);
          profiles = directResult.data;
          profilesError = directResult.error;
        }
      } catch (rpcException: any) {
        console.warn('⚠️ RPC function exception for sent receivers, trying direct query:', rpcException);
        // Fall back to direct query
        const directResult = await supabase
          .from('profiles')
          .select('id, username, email')
          .in('id', sentReceiverIds);
        profiles = directResult.data;
        profilesError = directResult.error;
      }

      console.log('Sent receiver profiles fetch result:', {
        dataCount: profiles?.length || 0,
        data: profiles,
        error: profilesError,
        receiverIds: sentReceiverIds,
      });

      if (profiles && !profilesError) {
        sentReceivers = profiles;
        profiles.forEach((profile: any) => {
          // Log if username is missing
          if (!profile.username || profile.username.trim() === '') {
            console.warn(`Profile for user ${profile.id} exists but username is empty. Email: ${profile.email}`);
          }
        });
        console.log(`Successfully fetched ${sentReceivers.length} sent receiver profiles out of ${sentReceiverIds.length} users`);
        console.log('Sent receiver profiles:', sentReceivers.map(p => ({ id: p.id, username: p.username, email: p.email })));
      } else {
        console.error('Failed to fetch sent receiver profiles:', profilesError);
        // Try individual fetches as fallback
        console.log('Attempting individual profile fetches for sent receivers...');
        for (const receiverId of sentReceiverIds) {
          try {
            const { data: singleProfile, error: singleError } = await supabase
              .from('profiles')
              .select('id, username, email')
              .eq('id', receiverId)
              .single();
            
            console.log(`Individual fetch for ${receiverId}:`, {
              profile: singleProfile,
              error: singleError,
            });
            
            if (singleProfile && !singleError) {
              sentReceivers.push(singleProfile);
              // Log if username is missing
              if (!singleProfile.username || singleProfile.username.trim() === '') {
                console.warn(`Profile for user ${receiverId} exists but username is empty. Email: ${singleProfile.email}`);
              } else {
                console.log(`Successfully fetched profile for ${receiverId}:`, singleProfile.username);
              }
            } else {
              console.error(`Failed to fetch profile for ${receiverId}:`, singleError);
            }
          } catch (err: any) {
            console.error(`Exception fetching profile for ${receiverId}:`, err);
          }
        }
      }
    }

    // Get user profiles for received requests (senders)
    const receivedSenderIds = receivedRequests.map(r => r.sender_id);
    let receivedSenders: any[] = [];
    if (receivedSenderIds.length > 0) {
      console.log('=== PROFILE FETCH DEBUG ===');
      console.log('Fetching profiles for received sender IDs:', receivedSenderIds);
      console.log('Current user ID (for RLS):', user.id);
      console.log('Number of sender IDs:', receivedSenderIds.length);
      
      // Test: Try fetching a single profile first to verify RLS works
      if (receivedSenderIds.length > 0) {
        const testId = receivedSenderIds[0];
        const { data: testProfile, error: testError } = await supabase
          .from('profiles')
          .select('id, username, email')
          .eq('id', testId)
          .single();
        console.log('Test single profile fetch:', {
          id: testId,
          profile: testProfile,
          profileStringified: JSON.stringify(testProfile),
          username: testProfile?.username,
          usernameType: typeof testProfile?.username,
          error: testError,
        });
        
        // If test profile exists, verify username extraction
        if (testProfile) {
          const testNormalized = normalizeProfileUsername(testProfile);
          console.log('Test username normalization:', {
            raw: testProfile.username,
            normalized: testNormalized,
            email: testProfile.email,
          });
        }
      }
      
      // Fetch profiles - Try using RPC function first (bypasses RLS issues)
      // If that fails, fall back to direct query
      console.log('🔍 Attempting to fetch profiles for sender IDs:', receivedSenderIds);
      console.log('🔍 Current user ID (should match auth.uid()):', user.id);
      
      let data: any[] | null = null;
      let receivedError: any = null;
      
      // Try using RPC function first (bypasses RLS)
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_profiles_for_friend_requests', {
          user_ids: receivedSenderIds
        });
        
        if (rpcData && !rpcError) {
          console.log('✅ RPC function successful, fetched profiles:', rpcData);
          data = rpcData;
        } else {
          console.warn('⚠️ RPC function failed, trying direct query:', rpcError);
          // Fall back to direct query
          const directResult = await supabase
            .from('profiles')
            .select('id, username, email')
            .in('id', receivedSenderIds);
          data = directResult.data;
          receivedError = directResult.error;
        }
      } catch (rpcException: any) {
        console.warn('⚠️ RPC function exception, trying direct query:', rpcException);
        // Fall back to direct query
        const directResult = await supabase
          .from('profiles')
          .select('id, username, email')
          .in('id', receivedSenderIds);
        data = directResult.data;
        receivedError = directResult.error;
      }
      
      console.log('Profile fetch result:', {
        dataCount: data?.length || 0,
        data: data,
        error: receivedError,
        errorCode: receivedError?.code,
        errorMessage: receivedError?.message,
        errorDetails: receivedError?.details,
        errorHint: receivedError?.hint,
        receivedSenderIds,
      });
      
      // If fetch failed or returned empty, try a direct query to test RLS
      if ((!data || data.length === 0) && receivedSenderIds.length > 0) {
        const testId = receivedSenderIds[0];
        console.log('⚠️ Profile fetch returned empty, testing direct query for:', testId);
        const { data: directTest, error: directError } = await supabase
          .from('profiles')
          .select('id, username, email')
          .eq('id', testId)
          .single();
        
        console.log('Direct profile test result:', {
          data: directTest,
          error: directError,
          errorCode: directError?.code,
          errorMessage: directError?.message,
        });
      }
      
      if (data && !receivedError) {
        receivedSenders = data;
        console.log('✅ Batch fetch successful. Received profiles:', receivedSenders);
        console.log('📋 Received sender profiles (detailed):', receivedSenders.map(p => ({ 
          id: p.id, 
          username: p.username,
          usernameType: typeof p.username,
          usernameIsNull: p.username === null,
          usernameIsUndefined: p.username === undefined,
          email: p.email 
        })));
        // Log if any usernames are missing
        receivedSenders.forEach((profile: any) => {
          if (!profile.username || profile.username.trim() === '') {
            console.error(`❌ Profile for user ${profile.id} exists but username is empty. Email: ${profile.email}`);
          } else {
            console.log(`✅ Profile for user ${profile.id} has username: "${profile.username}"`);
          }
        });
        console.log(`Successfully fetched ${receivedSenders.length} received sender profiles out of ${receivedSenderIds.length} users`);
      } else {
        console.error('Failed to fetch received sender profiles:', receivedError);
        console.warn('No data returned for received sender profiles (data is null/undefined)');
        // Try individual fetches as fallback
        console.log('Attempting individual profile fetches for received senders...');
        for (const senderId of receivedSenderIds) {
          try {
            const { data: singleProfile, error: singleError } = await supabase
              .from('profiles')
              .select('id, username, email')
              .eq('id', senderId)
              .single();
            
            console.log(`Individual fetch for ${senderId}:`, {
              profile: singleProfile,
              error: singleError,
            });
            
            if (singleProfile && !singleError) {
              receivedSenders.push(singleProfile);
              // Log if username is missing
              if (!singleProfile.username || singleProfile.username.trim() === '') {
                console.warn(`Profile for user ${senderId} exists but username is empty. Email: ${singleProfile.email}`);
              } else {
                console.log(`Successfully fetched profile for ${senderId}:`, singleProfile.username);
              }
            } else {
              console.error(`Failed to fetch profile for ${senderId}:`, singleError);
            }
          } catch (err: any) {
            console.error(`Exception fetching profile for ${senderId}:`, err);
          }
        }
      }
    }

    // Combine requests with user profiles
    // Use username DIRECTLY from profiles table (same pattern as messages route)
    const sentWithProfiles = sentRequests.map(request => {
      const receiver = sentReceivers.find(p => p.id === request.receiver_id);
      
      if (!receiver) {
        console.error(`CRITICAL: Profile not found for receiver ${request.receiver_id}`);
        console.error('Available receivers:', sentReceivers.map(r => ({ id: r.id, username: r.username })));
        return {
          ...request,
          user: {
            id: request.receiver_id,
            username: 'User', // Only use this if profile truly doesn't exist
            email: '',
            avatarUrl: null,
          },
        };
      }
      
      // Extract username directly - prioritize raw username from DB
      // Only use normalizeProfileUsername if username is missing/empty
      let profileUsername: string;
      if (receiver.username && typeof receiver.username === 'string' && receiver.username.trim().length > 0) {
        // Use username directly from database
        profileUsername = receiver.username.trim();
      } else {
        // Fallback to normalization (which will try email prefix, then 'User')
        profileUsername = normalizeProfileUsername(receiver);
      }
      
      const profileEmail = receiver.email?.trim() || '';
      
      return {
        ...request,
        user: {
          id: receiver.id,
          // Use username directly from database if available, otherwise normalized
          username: profileUsername,
          email: profileEmail,
          avatarUrl: null,
        },
      };
    });

    const receivedWithProfiles = receivedRequests.map(request => {
      // Try to find sender profile - check both exact match and string comparison
      let sender = receivedSenders.find(p => p.id === request.sender_id);
      
      // If not found, try string comparison (in case of UUID format differences)
      if (!sender) {
        sender = receivedSenders.find(p => String(p.id) === String(request.sender_id));
      }
      
      console.log(`🔍 Processing received request ${request.id}:`, {
        requestSenderId: request.sender_id,
        requestSenderIdType: typeof request.sender_id,
        senderFound: !!sender,
        senderData: sender ? {
          id: sender.id,
          username: sender.username,
          usernameRaw: sender.username,
          usernameTrimmed: sender.username?.trim(),
          email: sender.email,
          usernameType: typeof sender.username,
          usernameLength: sender.username?.length,
          usernameIsNull: sender.username === null,
          usernameIsUndefined: sender.username === undefined,
          usernameIsEmptyString: sender.username === '',
        } : null,
        allReceivedSenders: receivedSenders.map(s => ({ 
          id: s.id, 
          idType: typeof s.id,
          username: s.username,
          usernameType: typeof s.username,
        })),
        receivedSendersCount: receivedSenders.length,
        receivedSenderIds: receivedSenders.map(s => s.id),
      });
      
      if (!sender) {
        console.error(`CRITICAL: Profile not found for sender ${request.sender_id}`);
        console.error('Available senders:', receivedSenders.map(s => ({ id: s.id, username: s.username })));
        console.error('Request details:', { id: request.id, sender_id: request.sender_id, receiver_id: request.receiver_id });
        return {
          ...request,
          user: {
            id: request.sender_id,
            username: 'User', // Only use this if profile truly doesn't exist
            email: '',
            avatarUrl: null,
          },
        };
      }
      
      // Log raw sender data before normalization
      console.log(`Raw sender data for ${sender.id}:`, {
        rawUsername: sender.username,
        rawEmail: sender.email,
        usernameIsString: typeof sender.username === 'string',
        usernameIsNull: sender.username === null,
        usernameIsUndefined: sender.username === undefined,
        usernameTrimmed: sender.username?.trim(),
      });
      
      // Extract username directly - prioritize raw username from DB
      // Only use normalizeProfileUsername if username is missing/empty
      let profileUsername: string;
      if (sender.username && typeof sender.username === 'string' && sender.username.trim().length > 0) {
        // Use username directly from database
        profileUsername = sender.username.trim();
        console.log(`✅ Using direct username from DB for ${sender.id}: "${profileUsername}"`);
      } else {
        // Fallback to normalization (which will try email prefix, then 'User')
        profileUsername = normalizeProfileUsername(sender);
        console.warn(`⚠️ Username missing/empty for ${sender.id}, using normalized: "${profileUsername}"`, {
          rawUsername: sender.username,
          usernameType: typeof sender.username,
          email: sender.email,
        });
      }
      
      const profileEmail = sender.email?.trim() || '';
      
      console.log(`Final username for ${sender.id}:`, {
        profileUsername,
        profileEmail,
        rawSender: {
          id: sender.id,
          username: sender.username,
          email: sender.email,
        },
      });
      
      return {
        ...request,
        user: {
          id: sender.id,
          // Use username directly from database if available, otherwise normalized
          username: profileUsername,
          email: profileEmail,
          avatarUrl: null,
        },
      };
    });
    
    // Log for debugging - verify usernames come from profiles table
    console.log('=== API RESPONSE DEBUG ===');
    console.log('Sent receivers from DB:', JSON.stringify(sentReceivers, null, 2));
    console.log('Received senders from DB:', JSON.stringify(receivedSenders, null, 2));
    console.log('Sent requests with profiles:', JSON.stringify(sentWithProfiles.map(r => ({
      id: r.id,
      receiver_id: r.receiver_id,
      user: r.user
    })), null, 2));
    console.log('Received requests with profiles:', JSON.stringify(receivedWithProfiles.map(r => ({
      id: r.id,
      sender_id: r.sender_id,
      user: r.user
    })), null, 2));
    
    console.log('Friend requests with profiles summary:', {
      sentCount: sentWithProfiles.length,
      receivedCount: receivedWithProfiles.length,
      sentUsernames: sentWithProfiles.map(r => ({ 
        requestId: r.id, 
        receiverId: r.receiver_id,
        username: r.user?.username, 
        usernameSource: r.user?.username ? 'profiles.username' : 'MISSING',
        hasUser: !!r.user,
        profileExists: sentReceivers.some(p => p.id === r.receiver_id),
        profileData: sentReceivers.find(p => p.id === r.receiver_id),
      })),
      receivedUsernames: receivedWithProfiles.map(r => ({ 
        requestId: r.id, 
        senderId: r.sender_id,
        username: r.user?.username, 
        usernameSource: r.user?.username ? 'profiles.username' : 'MISSING',
        hasUser: !!r.user,
        profileExists: receivedSenders.some(p => p.id === r.sender_id),
        profileData: receivedSenders.find(p => p.id === r.sender_id),
      })),
      sentReceiversCount: sentReceivers.length,
      receivedSendersCount: receivedSenders.length,
      sentReceiverIds: sentReceiverIds,
      receivedSenderIds: receivedSenderIds,
      // Verify all profiles have usernames
      sentReceiversWithUsernames: sentReceivers.filter(p => p.username && p.username.trim()).length,
      receivedSendersWithUsernames: receivedSenders.filter(p => p.username && p.username.trim()).length,
    });
    
    // Critical check: if profiles exist but usernames are missing, log error
    if (sentReceivers.length > 0 && sentWithProfiles.some(r => !r.user?.username || r.user.username === 'User')) {
      console.error('CRITICAL: Some sent receiver profiles exist but usernames are missing!');
    }
    if (receivedSenders.length > 0 && receivedWithProfiles.some(r => !r.user?.username || r.user.username === 'User')) {
      console.error('CRITICAL: Some received sender profiles exist but usernames are missing!');
    }

    // Final verification before sending response
    console.log('=== FINAL API RESPONSE ===');
    console.log('Sent requests final:', JSON.stringify(sentWithProfiles.map(r => ({
      id: r.id,
      receiver_id: r.receiver_id,
      username: r.user?.username,
      email: r.user?.email,
    })), null, 2));
    console.log('Received requests final:', JSON.stringify(receivedWithProfiles.map(r => ({
      id: r.id,
      sender_id: r.sender_id,
      username: r.user?.username,
      email: r.user?.email,
    })), null, 2));
    
    // If profiles are missing, log critical error
    if (sentWithProfiles.some(r => !r.user?.username || r.user.username === 'User')) {
      console.error('CRITICAL: Sending response with missing usernames for sent requests!');
      console.error('Sent receivers count:', sentReceivers.length);
      console.error('Sent receiver IDs requested:', sentReceiverIds);
    }
    if (receivedWithProfiles.some(r => !r.user?.username || r.user.username === 'User')) {
      console.error('CRITICAL: Sending response with missing usernames for received requests!');
      console.error('Received senders count:', receivedSenders.length);
      console.error('Received sender IDs requested:', receivedSenderIds);
    }

    // Final response with proper structure
    const response = {
      sent: sentWithProfiles,
      received: receivedWithProfiles,
      message: 'Friend requests retrieved successfully',
    };
    
    console.log('=== FINAL API RESPONSE SUMMARY ===');
    console.log('Sent requests count:', sentWithProfiles.length);
    console.log('Received requests count:', receivedWithProfiles.length);
    console.log('Sent requests:', sentWithProfiles.map(r => ({ id: r.id, receiver_id: r.receiver_id, username: r.user?.username })));
    console.log('Received requests:', receivedWithProfiles.map(r => ({ id: r.id, sender_id: r.sender_id, username: r.user?.username })));
    
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error in GET /api/friends/requests:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

