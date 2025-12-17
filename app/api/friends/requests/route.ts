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
    // Use separate queries to ensure we get both sent and received requests
    const [sentResult, receivedResult] = await Promise.all([
      supabase
        .from('friend_requests')
        .select('id, sender_id, receiver_id, status, created_at')
        .eq('status', 'pending')
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('friend_requests')
        .select('id, sender_id, receiver_id, status, created_at')
        .eq('status', 'pending')
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false })
    ]);

    const sentError = sentResult.error;
    const receivedError = receivedResult.error;
    const sentData = sentResult.data || [];
    const receivedData = receivedResult.data || [];
    
    const friendRequests = [...sentData, ...receivedData];

    console.log('Raw friend requests from DB:', {
      sent: sentData,
      received: receivedData,
      total: friendRequests.length,
      currentUserId: user.id
    });
    
    if (sentError) {
      console.error('Error fetching sent friend requests:', sentError);
    }
    if (receivedError) {
      console.error('Error fetching received friend requests:', receivedError);
    }
    
    const requestsError = sentError || receivedError;

    if (requestsError) {
      console.error('Error fetching friend requests:', requestsError);
      return NextResponse.json(
        { error: 'Failed to fetch friend requests', details: requestsError.message },
        { status: 500 }
      );
    }

    // Separate sent and received requests
    const sentRequests = friendRequests.filter(r => r.sender_id === user.id);
    const receivedRequests = friendRequests.filter(r => r.receiver_id === user.id);

    // Get user profiles for sent requests (receivers)
    // Use EXACT same pattern as messages route
    const sentReceiverIds = sentRequests.map(r => r.receiver_id);
    let sentReceivers: any[] = [];
    if (sentReceiverIds.length > 0) {
      console.log('=== FETCHING SENT RECEIVER PROFILES ===');
      console.log('Receiver IDs to fetch:', sentReceiverIds);
      
      // Fetch profiles - RLS should allow viewing all profiles (migration 045)
      // Use EXACT same pattern as messages route
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, email, avatar_url')
        .in('id', sentReceiverIds);

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
              .select('id, username, email, avatar_url')
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
          .select('id, username, email, avatar_url')
          .eq('id', testId)
          .single();
        console.log('Test single profile fetch:', {
          id: testId,
          profile: testProfile,
          error: testError,
        });
      }
      
      // Fetch profiles - RLS should allow viewing all profiles (migration 045)
      // Use same pattern as messages route
      const { data, error: receivedError } = await supabase
        .from('profiles')
        .select('id, username, email, avatar_url')
        .in('id', receivedSenderIds);
      
      console.log('Profile fetch result:', {
        dataCount: data?.length || 0,
        data: data,
        error: receivedError,
        receivedSenderIds,
      });
      
      if (data && !receivedError) {
        receivedSenders = data;
        console.log('Batch fetch successful. Received profiles:', receivedSenders);
        // Log if any usernames are missing
        receivedSenders.forEach((profile: any) => {
          if (!profile.username || profile.username.trim() === '') {
            console.warn(`Profile for user ${profile.id} exists but username is empty. Email: ${profile.email}`);
          }
        });
        console.log(`Successfully fetched ${receivedSenders.length} received sender profiles out of ${receivedSenderIds.length} users`);
        console.log('Received sender profiles:', receivedSenders.map(p => ({ id: p.id, username: p.username, email: p.email })));
      } else {
        console.error('Failed to fetch received sender profiles:', receivedError);
        console.warn('No data returned for received sender profiles (data is null/undefined)');
        // Try individual fetches as fallback
        console.log('Attempting individual profile fetches for received senders...');
        for (const senderId of receivedSenderIds) {
          try {
            const { data: singleProfile, error: singleError } = await supabase
              .from('profiles')
              .select('id, username, email, avatar_url')
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
      
      // Always use profiles.username; trim and fallback to email prefix if needed
      const profileUsername = normalizeProfileUsername(receiver);
      const profileEmail = receiver.email?.trim() || '';
      
      return {
        ...request,
        user: {
          id: receiver.id,
          // Use username DIRECTLY from profiles table (required field)
          username: profileUsername || 'User',
          email: profileEmail,
          avatarUrl: receiver.avatar_url || null,
        },
      };
    });

    const receivedWithProfiles = receivedRequests.map(request => {
      const sender = receivedSenders.find(p => p.id === request.sender_id);
      
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
      
      // Always use profiles.username; trim and fallback to email prefix if needed
      const profileUsername = normalizeProfileUsername(sender);
      const profileEmail = sender.email?.trim() || '';
      
      return {
        ...request,
        user: {
          id: sender.id,
          // Use username DIRECTLY from profiles table (required field)
          username: profileUsername || 'User',
          email: profileEmail,
          avatarUrl: sender.avatar_url || null,
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

