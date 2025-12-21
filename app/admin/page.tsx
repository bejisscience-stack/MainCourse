'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import BackgroundShapes from '@/components/BackgroundShapes';
import { useUser } from '@/hooks/useUser';
import { useAdminEnrollmentRequests } from '@/hooks/useAdminEnrollmentRequests';
import { useAdminBundleEnrollmentRequests } from '@/hooks/useAdminBundleEnrollmentRequests';
import { useCourses } from '@/hooks/useCourses';
import { supabase } from '@/lib/supabase';
import type { EnrollmentRequest } from '@/hooks/useEnrollmentRequests';
import type { Course } from '@/components/CourseCard';

type TabType = 'overview' | 'enrollment-requests' | 'courses';

export default function AdminDashboard() {
  const router = useRouter();
  const { user, role: userRole, isLoading: userLoading, mutate: mutateUser } = useUser();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isAdminVerified, setIsAdminVerified] = useState<boolean | null>(null); // Direct DB verification
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<EnrollmentRequest | null>(null);

  // Fetch all requests for stats, and filtered requests for the table
  const {
    requests: allRequests,
    isLoading: allRequestsLoading,
    error: allRequestsError,
    mutate: mutateAllRequests,
    approveRequest: approveAllRequests,
    rejectRequest: rejectAllRequests,
  } = useAdminEnrollmentRequests(undefined); // Always fetch all for stats

  // Ensure we pass the correct status filter - 'all' means fetch all, otherwise use the filter
  const requestStatusFilter = statusFilter === 'all' ? undefined : statusFilter;
  
  const {
    requests,
    isLoading: requestsLoading,
    error: fetchError,
    approveRequest,
    rejectRequest,
    mutate: mutateRequests,
  } = useAdminEnrollmentRequests(requestStatusFilter);

  // Fetch all bundle requests for stats
  const {
    requests: allBundleRequests,
    isLoading: allBundleRequestsLoading,
    error: allBundleRequestsError,
    mutate: mutateAllBundleRequests,
  } = useAdminBundleEnrollmentRequests(undefined);

  // Fetch bundle enrollment requests with filter
  const {
    requests: bundleRequests,
    isLoading: bundleRequestsLoading,
    error: bundleFetchError,
    approveRequest: approveBundleRequest,
    rejectRequest: rejectBundleRequest,
    mutate: mutateBundleRequests,
  } = useAdminBundleEnrollmentRequests(requestStatusFilter);
  
  // Debug logging
  useEffect(() => {
    if (requests.length > 0) {
      console.log('[Admin Dashboard] Current requests:', requests.map(r => ({
        id: r.id,
        course: r.courses?.title || 'Unknown Course',
        status: r.status,
        user: r.profiles?.username || (r.profiles?.email ? r.profiles.email.split('@')[0] : 'User')
      })));
    }
  }, [requests]);

  const { courses, isLoading: coursesLoading } = useCourses('All');

  // Update both requests lists when approve/reject happens
  const handleApproveWithRefresh = async (requestId: string) => {
    // Approve using the filtered hook (which will update its own list)
    await approveRequest(requestId);
    // Also refresh all requests for stats
    await mutateAllRequests();
  };

  const handleRejectWithRefresh = async (requestId: string) => {
    // Reject using the filtered hook (which will update its own list)
    await rejectRequest(requestId);
    // Also refresh all requests for stats
    await mutateAllRequests();
  };

  // Direct database check on mount - bypass hook cache
  // Only run once on mount, not when dependencies change
  useEffect(() => {
    let isMounted = true;
    
    const verifyAdminDirectly = async () => {
      setIsCheckingAdmin(true);
      console.log('[Admin Page] === DIRECT ADMIN VERIFICATION ===');
      
      try {
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        console.log('[Admin Page] Session check:', { 
          hasSession: !!session, 
          userId: session?.user?.id,
          sessionError 
        });
        
        if (sessionError || !session?.user) {
          console.log('[Admin Page] No session, redirecting to login');
          if (isMounted) {
            setIsAdminVerified(false);
            setIsCheckingAdmin(false);
            router.push('/login');
          }
          return;
        }
        
        const userId = session.user.id;
        console.log('[Admin Page] Checking admin status for user:', userId);
        
        // Use RPC function to check admin status (bypasses RLS)
        const { data: isAdmin, error: rpcError } = await supabase
          .rpc('check_is_admin', { user_id: userId });
        
        if (!isMounted) return;
        
        console.log('[Admin Page] RPC check_is_admin result:', { 
          isAdmin, 
          error: rpcError
        });
        
        if (!rpcError && isAdmin === true) {
          console.log('[Admin Page] ✓✓✓ DIRECT VERIFICATION: User IS admin!');
          setIsAdminVerified(true);
        } else {
          console.log('[Admin Page] ❌ DIRECT VERIFICATION: User is NOT admin');
          setIsAdminVerified(false);
        }
      } catch (err: any) {
        console.error('[Admin Page] Error in direct admin verification:', err);
        if (isMounted) {
          setIsAdminVerified(false);
        }
      } finally {
        if (isMounted) {
          setIsCheckingAdmin(false);
        }
      }
    };
    
    verifyAdminDirectly();
    
    return () => {
      isMounted = false;
    };
  }, []); // Only run once on mount

  // Redirect if not admin - but only if direct verification failed
  // Use a ref to prevent multiple redirects
  const hasRedirected = useRef(false);
  
  useEffect(() => {
    // Wait for direct verification to complete
    if (isCheckingAdmin) {
      return;
    }
    
    // If direct verification confirmed admin, allow access
    if (isAdminVerified === true) {
      hasRedirected.current = false;
      return;
    }
    
    // If hook also confirms admin, allow access (fallback)
    if (userRole === 'admin' && !userLoading) {
      hasRedirected.current = false;
      return;
    }
    
    // If direct verification failed AND hook doesn't confirm admin, redirect (only once)
    if (isAdminVerified === false && userRole !== 'admin' && !userLoading && !hasRedirected.current) {
      hasRedirected.current = true;
      if (userRole === 'lecturer') {
        router.push('/lecturer/dashboard');
      } else {
        router.push('/');
      }
      return;
    }
    
    // If no user and not loading, redirect to login (only once)
    if (!userLoading && !user && !hasRedirected.current) {
      hasRedirected.current = true;
      router.push('/login');
      return;
    }
  }, [isAdminVerified, isCheckingAdmin, user, userRole, userLoading, router]);

  const handleApprove = async (requestId: string) => {
    setError(null);
    setSuccessMessage(null);
    setProcessingId(requestId);

    try {
      await handleApproveWithRefresh(requestId);
      setSuccessMessage('Enrollment request approved successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to approve request');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setError(null);
    setSuccessMessage(null);
    setProcessingId(requestId);

    try {
      await handleRejectWithRefresh(requestId);
      setSuccessMessage('Enrollment request rejected successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reject request');
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleRowClick = (request: EnrollmentRequest) => {
    setSelectedRequest(request);
  };

  const closeRequestDialog = () => {
    setSelectedRequest(null);
  };

  const handleApproveFromDialog = async (requestId: string) => {
    await handleApprove(requestId);
    closeRequestDialog();
  };

  const handleRejectFromDialog = async (requestId: string) => {
    await handleReject(requestId);
    closeRequestDialog();
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-semibold';
    switch (status) {
      case 'pending':
        return (
          <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>
            Pending
          </span>
        );
      case 'approved':
        return (
          <span className={`${baseClasses} bg-green-100 text-green-800`}>
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className={`${baseClasses} bg-red-100 text-red-800`}>
            Rejected
          </span>
        );
      default:
        return <span className={baseClasses}>{status}</span>;
    }
  };

  // Calculate stats for overview using all requests (not filtered)
  const pendingCount = allRequests.filter(r => r.status === 'pending').length;
  const approvedCount = allRequests.filter(r => r.status === 'approved').length;
  const rejectedCount = allRequests.filter(r => r.status === 'rejected').length;
  
  // Calculate bundle stats
  const bundlePendingCount = allBundleRequests.filter(r => r.status === 'pending').length;
  const totalPendingCount = pendingCount + bundlePendingCount;
  
  const totalCourses = courses.length;

  // Show loading while checking admin status via direct DB query
  if (isCheckingAdmin || (isAdminVerified === null && userLoading)) {
    return (
      <main className="relative min-h-screen bg-white overflow-hidden">
        <BackgroundShapes />
        <Navigation />
        <div className="relative z-10 pt-24 pb-16 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-navy-900 mb-4"></div>
            <p className="text-navy-700">Verifying admin access...</p>
          </div>
        </div>
      </main>
    );
  }

  // If direct verification failed, show nothing (redirect happens in useEffect)
  if (isAdminVerified === false) {
    return null;
  }
  
  // Only render if admin is verified (either by direct check or hook confirms admin)
  if (isAdminVerified !== true && userRole !== 'admin') {
    return null;
  }

  return (
    <main className="relative min-h-screen bg-white overflow-hidden">
      <BackgroundShapes />
      <Navigation />
      <div className="relative z-10 pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-navy-900 mb-4">
              Admin Dashboard
            </h1>
            <p className="text-lg text-navy-600">
              Manage enrollment requests, courses, and system access
            </p>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-3 mb-8 border-b border-navy-200">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'overview'
                  ? 'text-navy-900 border-navy-900'
                  : 'text-navy-600 border-transparent hover:text-navy-900 hover:border-navy-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('enrollment-requests')}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 relative ${
                activeTab === 'enrollment-requests'
                  ? 'text-navy-900 border-navy-900'
                  : 'text-navy-600 border-transparent hover:text-navy-900 hover:border-navy-300'
              }`}
            >
              Enrollment Requests
              {totalPendingCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                  {totalPendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('courses')}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'courses'
                  ? 'text-navy-900 border-navy-900'
                  : 'text-navy-600 border-transparent hover:text-navy-900 hover:border-navy-300'
              }`}
            >
              All Courses ({totalCourses})
            </button>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              {successMessage}
            </div>
          )}

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Pending Requests</p>
                      <p className="text-3xl font-bold text-yellow-600 mt-2">{totalPendingCount}</p>
                    </div>
                    <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Approved</p>
                      <p className="text-3xl font-bold text-green-600 mt-2">{approvedCount}</p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Rejected</p>
                      <p className="text-3xl font-bold text-red-600 mt-2">{rejectedCount}</p>
                    </div>
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Courses</p>
                      <p className="text-3xl font-bold text-navy-900 mt-2">{totalCourses}</p>
                    </div>
                    <div className="w-12 h-12 bg-navy-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-navy-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-navy-900 mb-4">Quick Actions</h2>
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={() => {
                      setActiveTab('enrollment-requests');
                      setStatusFilter('pending');
                    }}
                    className="px-6 py-3 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600 transition-colors"
                  >
                    Review Pending Requests ({totalPendingCount})
                  </button>
                  <button
                    onClick={() => setActiveTab('courses')}
                    className="px-6 py-3 bg-navy-900 text-white rounded-lg font-semibold hover:bg-navy-800 transition-colors"
                  >
                    View All Courses
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'enrollment-requests' && (
            <div>
              {/* Manual Refresh Button and Debug Info */}
              <div className="mb-4 flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  Showing {requests.length} request{requests.length !== 1 ? 's' : ''} 
                  {statusFilter !== 'all' && ` (${statusFilter})`}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      // Test endpoint to see what's in the database
                      const token = (await supabase.auth.getSession()).data.session?.access_token;
                      if (token) {
                        const response = await fetch('/api/admin/enrollment-requests/test', {
                          headers: { 'Authorization': `Bearer ${token}` }
                        });
                        const data = await response.json();
                        console.log('[Admin Dashboard] Test endpoint results:', data);
                        alert(`Direct Query: ${data.directQuery?.count || 0}\nRPC Pending: ${data.rpcPending?.count || 0}\nRPC All: ${data.rpcAll?.count || 0}\n\nCheck console for details.`);
                      }
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors text-sm flex items-center gap-2"
                  >
                    Test DB
                  </button>
                  <button
                      onClick={() => {
                        mutateRequests();
                        mutateAllRequests();
                        mutateBundleRequests();
                        mutateAllBundleRequests();
                      }}
                    className="px-4 py-2 bg-navy-900 text-white rounded-lg font-semibold hover:bg-navy-800 transition-colors text-sm flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </button>
                </div>
              </div>
              
              {/* Filter Buttons */}
              <div className="flex flex-wrap gap-3 mb-6">
                {(['all', 'pending', 'approved', 'rejected'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors capitalize ${
                      statusFilter === filter
                        ? 'bg-navy-900 text-white'
                        : 'bg-navy-50 text-navy-700 hover:bg-navy-100'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              {/* Requests Table */}
              {(fetchError || allRequestsError) ? (
                <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg text-center">
                  <p className="font-semibold">Error loading requests</p>
                  <p className="text-sm mt-1">{(fetchError || allRequestsError)?.message}</p>
                </div>
              ) : (requestsLoading || allRequestsLoading) ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-navy-900 mb-4"></div>
                  <p className="text-navy-700">Loading enrollment requests...</p>
                </div>
              ) : requests.length === 0 ? (
                <div className="bg-navy-50 border border-navy-100 rounded-lg p-8 text-center text-navy-700">
                  <p className="text-lg font-medium">
                    No {statusFilter === 'all' ? '' : statusFilter} enrollment requests found
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            User
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Course
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Requested
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Reviewed
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {requests.map((request: EnrollmentRequest) => {
                          const userProfile = request.profiles;
                          const course = request.courses;
                          const isProcessing = processingId === request.id;

                          return (
                            <tr
                              key={request.id}
                              className="hover:bg-gray-50 cursor-pointer transition-colors"
                              onClick={() => handleRowClick(request)}
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {userProfile?.username || (userProfile?.email ? userProfile.email.split('@')[0] : 'User')}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {userProfile?.email}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {course?.title || 'Unknown Course'}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {getStatusBadge(request.status)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatDate(request.created_at)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {request.reviewed_at ? formatDate(request.reviewed_at) : '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                                {request.status === 'pending' ? (
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => handleApprove(request.id)}
                                      disabled={isProcessing}
                                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {isProcessing ? 'Processing...' : 'Approve'}
                                    </button>
                                    <button
                                      onClick={() => handleReject(request.id)}
                                      disabled={isProcessing}
                                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {isProcessing ? 'Processing...' : 'Reject'}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-gray-400">No actions</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Bundle Enrollment Requests Section */}
              <div className="mt-12">
                <h2 className="text-2xl font-bold text-navy-900 mb-6">Bundle Enrollment Requests</h2>
                
                {(bundleFetchError) ? (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg text-center">
                    <p className="font-semibold">Error loading bundle requests</p>
                    <p className="text-sm mt-1">{bundleFetchError?.message}</p>
                  </div>
                ) : (bundleRequestsLoading) ? (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-navy-900 mb-4"></div>
                    <p className="text-navy-700">Loading bundle enrollment requests...</p>
                  </div>
                ) : bundleRequests.length === 0 ? (
                  <div className="bg-purple-50 border border-purple-100 rounded-lg p-8 text-center text-purple-700">
                    <p className="text-lg font-medium">
                      No {statusFilter === 'all' ? '' : statusFilter} bundle enrollment requests found
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow-sm border border-purple-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-purple-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              User
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Bundle
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Price
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Requested
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {bundleRequests.map((request) => {
                            const isProcessing = processingId === request.id;
                            return (
                              <tr
                                key={request.id}
                                className="hover:bg-gray-50 cursor-pointer"
                                onClick={() => {
                                  // Could add bundle request dialog here if needed
                                }}
                              >
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">
                                    {request.profiles?.username || request.profiles?.email?.split('@')[0] || 'Unknown User'}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {request.profiles?.email || 'N/A'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">
                                    {request.bundles?.title || 'Unknown Bundle'}
                                  </div>
                                  <div className="text-xs text-purple-600">Bundle</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">
                                    ${request.bundles?.price?.toFixed(2) || '0.00'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {getStatusBadge(request.status)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {formatDate(request.created_at)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  {request.status === 'pending' ? (
                                    <div className="flex gap-2">
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          setProcessingId(request.id);
                                          try {
                                            await approveBundleRequest(request.id);
                                            setSuccessMessage('Bundle enrollment request approved successfully');
                                            setTimeout(() => setSuccessMessage(null), 3000);
                                          } catch (err: any) {
                                            setError(err.message || 'Failed to approve bundle request');
                                          } finally {
                                            setProcessingId(null);
                                          }
                                        }}
                                        disabled={isProcessing}
                                        className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                                      >
                                        {isProcessing ? 'Processing...' : 'Approve'}
                                      </button>
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          setProcessingId(request.id);
                                          try {
                                            await rejectBundleRequest(request.id);
                                            setSuccessMessage('Bundle enrollment request rejected successfully');
                                            setTimeout(() => setSuccessMessage(null), 3000);
                                          } catch (err: any) {
                                            setError(err.message || 'Failed to reject bundle request');
                                          } finally {
                                            setProcessingId(null);
                                          }
                                        }}
                                        disabled={isProcessing}
                                        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                                      >
                                        {isProcessing ? 'Processing...' : 'Reject'}
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">No actions</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'courses' && (
            <div>
              {coursesLoading ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-navy-900 mb-4"></div>
                  <p className="text-navy-700">Loading courses...</p>
                </div>
              ) : courses.length === 0 ? (
                <div className="bg-navy-50 border border-navy-100 rounded-lg p-8 text-center text-navy-700">
                  <p className="text-lg font-medium">No courses found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {courses.map((course: Course) => (
                    <div
                      key={course.id}
                      className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                    >
                      <div className="p-6">
                        <h3 className="text-lg font-bold text-navy-900 mb-2">{course.title}</h3>
                        <p className="text-sm text-gray-600 mb-4">{course.instructor}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xl font-bold text-navy-900">${course.price}</span>
                          <Link
                            href={`/courses/${course.id}/chat`}
                            className="px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors text-sm font-semibold"
                          >
                            Open Chat
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Request Details Dialog */}
      {selectedRequest && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={closeRequestDialog}
        >
          <div
            className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={closeRequestDialog}
              className="absolute top-4 right-4 z-10 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 transition-colors"
              aria-label="Close dialog"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <div className="p-6 space-y-6">
              {/* Header */}
              <div>
                <h2 className="text-2xl font-bold text-navy-900 mb-2">Enrollment Request Details</h2>
                <p className="text-gray-600">Review all information before making a decision</p>
              </div>

              {/* User Information */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">User Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Username</p>
                    <p className="text-base font-medium text-gray-900">
                      {selectedRequest.profiles?.username || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="text-base font-medium text-gray-900">
                      {selectedRequest.profiles?.email || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">User ID</p>
                    <p className="text-base font-mono text-sm text-gray-700">
                      {selectedRequest.user_id}
                    </p>
                  </div>
                </div>
              </div>

              {/* Course Information */}
              <div className="bg-navy-50 rounded-lg p-4 space-y-3">
                <h3 className="text-lg font-semibold text-navy-900">Course Information</h3>
                <div>
                  <p className="text-sm text-navy-600">Course Title</p>
                  <p className="text-base font-medium text-navy-900">
                    {selectedRequest.courses?.title || 'Unknown Course'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-navy-600">Course ID</p>
                  <p className="text-base font-mono text-sm text-navy-700">
                    {selectedRequest.course_id}
                  </p>
                </div>
              </div>

              {/* Request Details */}
              <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">Request Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <div className="mt-1">
                      {getStatusBadge(selectedRequest.status)}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Request ID</p>
                    <p className="text-base font-mono text-sm text-gray-700">
                      {selectedRequest.id}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Requested At</p>
                    <p className="text-base text-gray-900">
                      {formatDate(selectedRequest.created_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Last Updated</p>
                    <p className="text-base text-gray-900">
                      {formatDate(selectedRequest.updated_at)}
                    </p>
                  </div>
                  {selectedRequest.reviewed_at && (
                    <>
                      <div>
                        <p className="text-sm text-gray-600">Reviewed At</p>
                        <p className="text-base text-gray-900">
                          {formatDate(selectedRequest.reviewed_at)}
                        </p>
                      </div>
                      {selectedRequest.reviewed_by && (
                        <div>
                          <p className="text-sm text-gray-600">Reviewed By</p>
                          <p className="text-base font-mono text-sm text-gray-700">
                            {selectedRequest.reviewed_by}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Payment Screenshots */}
              {selectedRequest.payment_screenshots && Array.isArray(selectedRequest.payment_screenshots) && selectedRequest.payment_screenshots.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Payment Screenshots ({selectedRequest.payment_screenshots.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedRequest.payment_screenshots.map((url: string, index: number) => (
                      <div
                        key={index}
                        className="relative group bg-gray-50 rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
                      >
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={url}
                            alt={`Payment screenshot ${index + 1}`}
                            className="w-full h-64 object-contain cursor-pointer bg-white"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 px-4 py-2 rounded-lg text-sm font-medium text-gray-900 shadow-lg">
                              View Full Size
                            </div>
                          </div>
                        </a>
                        <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded font-semibold">
                          {index + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Screenshots Message */}
              {(!selectedRequest.payment_screenshots || 
                !Array.isArray(selectedRequest.payment_screenshots) || 
                selectedRequest.payment_screenshots.length === 0) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <svg
                      className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-yellow-800">No Payment Screenshots</p>
                      <p className="text-sm text-yellow-700 mt-1">
                        This enrollment request does not have any payment screenshots attached.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {selectedRequest.status === 'pending' && (
                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={closeRequestDialog}
                    className="px-6 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => handleRejectFromDialog(selectedRequest.id)}
                    disabled={processingId === selectedRequest.id}
                    className="px-6 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingId === selectedRequest.id ? 'Processing...' : 'Reject Request'}
                  </button>
                  <button
                    onClick={() => handleApproveFromDialog(selectedRequest.id)}
                    disabled={processingId === selectedRequest.id}
                    className="px-6 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingId === selectedRequest.id ? 'Processing...' : 'Approve Request'}
                  </button>
                </div>
              )}

              {selectedRequest.status !== 'pending' && (
                <div className="flex items-center justify-end pt-4 border-t border-gray-200">
                  <button
                    onClick={closeRequestDialog}
                    className="px-6 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
