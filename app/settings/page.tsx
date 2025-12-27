'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import BackgroundShapes from '@/components/BackgroundShapes';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { useI18n } from '@/contexts/I18nContext';
import { useEnrollments } from '@/hooks/useEnrollments';
import { useBalance } from '@/hooks/useBalance';
import { useWithdrawalRequests } from '@/hooks/useWithdrawalRequests';
import useSWR from 'swr';
import type { Course } from '@/hooks/useCourses';

export default function SettingsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { user, isLoading: userLoading } = useUser();
  const { enrolledCourseIds, isLoading: enrollmentsLoading } = useEnrollments(user?.id || null);
  const [referralCode, setReferralCode] = useState<string>('');
  const [loadingReferralCode, setLoadingReferralCode] = useState(true);
  
  // Balance and withdrawal state
  const { 
    balance, 
    bankAccountNumber, 
    pendingWithdrawal, 
    totalEarned, 
    totalWithdrawn,
    transactions,
    isLoading: balanceLoading,
    updateBankAccount,
    requestWithdrawal,
    mutate: mutateBalance
  } = useBalance(user?.id || null);
  
  const { requests: withdrawalRequests, mutate: mutateWithdrawals } = useWithdrawalRequests(user?.id || null);
  
  const [bankAccountInput, setBankAccountInput] = useState('');
  const [isUpdatingBankAccount, setIsUpdatingBankAccount] = useState(false);
  const [bankAccountError, setBankAccountError] = useState<string | null>(null);
  const [bankAccountSuccess, setBankAccountSuccess] = useState(false);
  
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [isRequestingWithdrawal, setIsRequestingWithdrawal] = useState(false);
  const [withdrawalError, setWithdrawalError] = useState<string | null>(null);
  const [withdrawalSuccess, setWithdrawalSuccess] = useState(false);
  const [showWithdrawalForm, setShowWithdrawalForm] = useState(false);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  
  // Password update state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  
  // Initialize bank account input when data loads
  useEffect(() => {
    if (bankAccountNumber && !bankAccountInput) {
      setBankAccountInput(bankAccountNumber);
    }
  }, [bankAccountNumber, bankAccountInput]);

  // Redirect if not logged in
  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login?redirect=/settings');
    }
  }, [user, userLoading, router]);

  // Fetch referral code
  useEffect(() => {
    if (user?.id) {
      fetchReferralCode();
    }
  }, [user?.id]);

  const fetchReferralCode = async () => {
    try {
      setLoadingReferralCode(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', user!.id)
        .single();

      if (error) throw error;
      setReferralCode(data?.referral_code || '');
    } catch (err: any) {
      console.error('Error fetching referral code:', err);
    } finally {
      setLoadingReferralCode(false);
    }
  };

  const handleCopyReferralCode = useCallback(() => {
    if (referralCode) {
      navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [referralCode]);

  const handleCopyReferralLink = useCallback((link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLink(link);
    setTimeout(() => setCopiedLink(null), 2000);
  }, []);

  // Fetch enrolled courses only
  const enrolledIdsArray = useMemo(() => Array.from(enrolledCourseIds).sort(), [enrolledCourseIds]);
  
  const { data: enrolledCourses = [], isLoading: coursesLoading } = useSWR<Course[]>(
    user && enrolledIdsArray.length > 0 ? ['enrolled-courses-for-referral', user.id, enrolledIdsArray.join(',')] : null,
    async () => {
      if (enrolledIdsArray.length === 0) return [];
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .in('id', enrolledIdsArray)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  );

  const getReferralLink = useCallback((courseId?: string) => {
    if (typeof window === 'undefined' || !referralCode) return '';
    const baseUrl = window.location.origin;
    const link = courseId 
      ? `${baseUrl}/signup?ref=${referralCode}&course=${courseId}`
      : `${baseUrl}/signup?ref=${referralCode}`;
    return link;
  }, [referralCode]);

  const handleBankAccountUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBankAccountError(null);
    setBankAccountSuccess(false);

    if (!bankAccountInput || bankAccountInput.trim().length < 10) {
      setBankAccountError(t('settings.invalidBankAccount') || 'Please enter a valid bank account number (at least 10 characters)');
      return;
    }

    setIsUpdatingBankAccount(true);

    try {
      await updateBankAccount(bankAccountInput.trim());
      setBankAccountSuccess(true);
      setTimeout(() => setBankAccountSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error updating bank account:', err);
      setBankAccountError(err.message || t('settings.failedToUpdateBankAccount') || 'Failed to update bank account');
    } finally {
      setIsUpdatingBankAccount(false);
    }
  };

  const handleWithdrawalRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawalError(null);
    setWithdrawalSuccess(false);

    const amount = parseFloat(withdrawalAmount);

    if (!amount || amount < 20) {
      setWithdrawalError(t('settings.minimumWithdrawal') || 'Minimum withdrawal amount is 20 GEL');
      return;
    }

    if (amount > balance) {
      setWithdrawalError(t('settings.insufficientBalance') || 'Insufficient balance');
      return;
    }

    const accountToUse = bankAccountInput.trim() || bankAccountNumber;
    if (!accountToUse || accountToUse.length < 10) {
      setWithdrawalError(t('settings.bankAccountRequired') || 'Please enter a valid bank account number first');
      return;
    }

    setIsRequestingWithdrawal(true);

    try {
      await requestWithdrawal(amount, accountToUse);
      setWithdrawalSuccess(true);
      setWithdrawalAmount('');
      setShowWithdrawalForm(false);
      mutateWithdrawals();
      mutateBalance();
      setTimeout(() => setWithdrawalSuccess(false), 5000);
    } catch (err: any) {
      console.error('Error requesting withdrawal:', err);
      setWithdrawalError(err.message || t('settings.failedToRequestWithdrawal') || 'Failed to request withdrawal');
    } finally {
      setIsRequestingWithdrawal(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTransactionIcon = (type: string, source: string) => {
    if (type === 'credit') {
      if (source === 'referral_commission') {
        return (
          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
      }
      return (
        <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
      </svg>
    );
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(t('settings.allFieldsRequired'));
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError(t('settings.passwordTooShort'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t('settings.passwordsDoNotMatch'));
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError(t('settings.newPasswordMustBeDifferent'));
      return;
    }

    setIsUpdatingPassword(true);

    try {
      // First, verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: currentPassword,
      });

      if (signInError) {
        setPasswordError(t('settings.currentPasswordIncorrect'));
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Clear success message after 3 seconds
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error updating password:', err);
      setPasswordError(err.message || t('settings.failedToUpdatePassword'));
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (userLoading) {
    return (
      <main className="relative min-h-screen bg-gradient-to-b from-[#fafafa] to-white dark:from-navy-950 dark:to-navy-900 overflow-hidden">
        <BackgroundShapes />
        <Navigation />
        <div className="relative z-10 pt-24 pb-16 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            <p className="mt-4 text-charcoal-600 dark:text-gray-400">{t('common.loading')}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-[#fafafa] to-white dark:from-navy-950 dark:to-navy-900 overflow-hidden">
      <BackgroundShapes />
      <Navigation />
      <div className="relative z-10 pt-24 pb-16 md:pb-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white mb-2">{t('settings.title')}</h1>
            <p className="text-lg text-charcoal-600 dark:text-gray-400">{t('settings.subtitle')}</p>
          </div>

          <div className="space-y-6">
            {/* Referral Code Section */}
            <div className="bg-white dark:bg-navy-800 border border-charcoal-100/50 dark:border-navy-700/50 rounded-3xl p-6 shadow-soft">
              <h2 className="text-xl font-semibold text-charcoal-950 dark:text-white mb-4">{t('settings.referralCode')}</h2>
              <p className="text-sm text-charcoal-600 dark:text-gray-400 mb-4">{t('settings.referralCodeDescription')}</p>
              
              {loadingReferralCode ? (
                <div className="flex items-center justify-center py-4">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
                </div>
              ) : referralCode ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-charcoal-50 dark:bg-navy-700/50 border border-charcoal-200 dark:border-navy-600 rounded-xl px-4 py-3">
                    <p className="text-2xl font-mono font-bold text-charcoal-950 dark:text-white tracking-wider">{referralCode}</p>
                  </div>
                  <button
                    onClick={handleCopyReferralCode}
                    className="px-6 py-3 bg-charcoal-950 dark:bg-emerald-500 text-white font-semibold rounded-xl hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-all duration-200 hover:shadow-soft dark:hover:shadow-glow-dark flex items-center gap-2"
                  >
                    {copied ? (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {t('settings.copied')}
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        {t('settings.copy')}
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">{t('settings.referralCodeNotAvailable')}</p>
                </div>
              )}
            </div>

            {/* Balance & Earnings Section */}
            <div className="bg-white dark:bg-navy-800 border border-charcoal-100/50 dark:border-navy-700/50 rounded-3xl p-6 shadow-soft">
              <h2 className="text-xl font-semibold text-charcoal-950 dark:text-white mb-4">
                {t('settings.balanceAndEarnings') || 'Balance & Earnings'}
              </h2>
              <p className="text-sm text-charcoal-600 dark:text-gray-400 mb-6">
                {t('settings.balanceDescription') || 'View your earnings from referrals and course purchases, and manage withdrawals.'}
              </p>

              {balanceLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Balance Overview Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                      <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">
                        {t('settings.currentBalance') || 'Current Balance'}
                      </p>
                      <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                        ₾{balance.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                      <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">
                        {t('settings.totalEarned') || 'Total Earned'}
                      </p>
                      <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                        ₾{totalEarned.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
                      <p className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-1">
                        {t('settings.totalWithdrawn') || 'Total Withdrawn'}
                      </p>
                      <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                        ₾{totalWithdrawn.toFixed(2)}
                      </p>
                    </div>
                    {pendingWithdrawal > 0 && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                        <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400 uppercase tracking-wide mb-1">
                          {t('settings.pendingWithdrawal') || 'Pending'}
                        </p>
                        <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                          ₾{pendingWithdrawal.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Bank Account Section */}
                  <div className="border-t border-charcoal-200 dark:border-navy-600 pt-6">
                    <h3 className="text-lg font-medium text-charcoal-950 dark:text-white mb-4">
                      {t('settings.bankAccount') || 'Bank Account'}
                    </h3>
                    <form onSubmit={handleBankAccountUpdate} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-2">
                          {t('settings.bankAccountNumber') || 'Bank Account Number (IBAN)'}
                        </label>
                        <input
                          type="text"
                          value={bankAccountInput}
                          onChange={(e) => setBankAccountInput(e.target.value)}
                          placeholder="GE00XX0000000000000000"
                          className="w-full px-4 py-3 bg-white dark:bg-navy-700/50 border border-charcoal-200 dark:border-navy-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent text-charcoal-950 dark:text-white placeholder-charcoal-400 dark:placeholder-gray-500"
                          disabled={isUpdatingBankAccount}
                        />
                        <p className="text-xs text-charcoal-500 dark:text-gray-400 mt-1">
                          {t('settings.bankAccountHint') || 'Enter your Georgian bank account number (IBAN format)'}
                        </p>
                      </div>

                      {bankAccountError && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
                          {bankAccountError}
                        </div>
                      )}

                      {bankAccountSuccess && (
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-xl text-sm">
                          {t('settings.bankAccountUpdated') || 'Bank account updated successfully!'}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isUpdatingBankAccount || bankAccountInput === bankAccountNumber}
                        className="px-6 py-3 bg-charcoal-950 dark:bg-emerald-500 text-white font-semibold rounded-xl hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isUpdatingBankAccount ? (t('settings.saving') || 'Saving...') : (t('settings.saveBankAccount') || 'Save Bank Account')}
                      </button>
                    </form>
                  </div>

                  {/* Withdrawal Section */}
                  <div className="border-t border-charcoal-200 dark:border-navy-600 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-charcoal-950 dark:text-white">
                        {t('settings.withdrawFunds') || 'Withdraw Funds'}
                      </h3>
                      {!showWithdrawalForm && balance >= 20 && (
                        <button
                          onClick={() => setShowWithdrawalForm(true)}
                          className="px-4 py-2 bg-emerald-500 text-white font-semibold rounded-xl hover:bg-emerald-600 transition-all duration-200"
                        >
                          {t('settings.requestWithdrawal') || 'Request Withdrawal'}
                        </button>
                      )}
                    </div>

                    {balance < 20 && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                        <p className="text-sm text-yellow-800 dark:text-yellow-300">
                          {t('settings.minimumBalanceRequired') || 'Minimum balance of ₾20.00 is required to request a withdrawal.'}
                        </p>
                      </div>
                    )}

                    {pendingWithdrawal > 0 && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-4">
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                          {t('settings.pendingWithdrawalMessage', { amount: pendingWithdrawal.toFixed(2) })}
                        </p>
                      </div>
                    )}

                    {showWithdrawalForm && balance >= 20 && pendingWithdrawal === 0 && (
                      <form onSubmit={handleWithdrawalRequest} className="space-y-4 bg-charcoal-50 dark:bg-navy-700/30 rounded-xl p-4">
                        <div>
                          <label className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-2">
                            {t('settings.withdrawalAmount') || 'Withdrawal Amount (₾)'}
                          </label>
                          <input
                            type="number"
                            min="20"
                            max={balance}
                            step="0.01"
                            value={withdrawalAmount}
                            onChange={(e) => setWithdrawalAmount(e.target.value)}
                            placeholder="20.00"
                            className="w-full px-4 py-3 bg-white dark:bg-navy-700/50 border border-charcoal-200 dark:border-navy-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent text-charcoal-950 dark:text-white placeholder-charcoal-400 dark:placeholder-gray-500"
                            disabled={isRequestingWithdrawal}
                          />
                        <p className="text-xs text-charcoal-500 dark:text-gray-400 mt-1">
                          {t('settings.availableBalance', { balance: balance.toFixed(2) })}
                        </p>
                        </div>

                        {withdrawalError && (
                          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
                            {withdrawalError}
                          </div>
                        )}

                        <div className="flex gap-3">
                          <button
                            type="submit"
                            disabled={isRequestingWithdrawal}
                            className="flex-1 px-6 py-3 bg-emerald-500 text-white font-semibold rounded-xl hover:bg-emerald-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isRequestingWithdrawal ? (t('settings.processing') || 'Processing...') : (t('settings.submitWithdrawal') || 'Submit Withdrawal Request')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowWithdrawalForm(false);
                              setWithdrawalAmount('');
                              setWithdrawalError(null);
                            }}
                            className="px-6 py-3 bg-charcoal-200 dark:bg-navy-600 text-charcoal-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-charcoal-300 dark:hover:bg-navy-500 transition-all duration-200"
                          >
                            {t('common.cancel') || 'Cancel'}
                          </button>
                        </div>
                      </form>
                    )}

                    {withdrawalSuccess && (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-xl text-sm mt-4">
                        {t('settings.withdrawalRequestSubmitted') || 'Withdrawal request submitted successfully! You will be notified once it is processed.'}
                      </div>
                    )}
                  </div>

                  {/* Transaction History */}
                  {transactions.length > 0 && (
                    <div className="border-t border-charcoal-200 dark:border-navy-600 pt-6">
                      <button
                        onClick={() => setShowTransactionHistory(!showTransactionHistory)}
                        className="flex items-center justify-between w-full text-left"
                      >
                        <h3 className="text-lg font-medium text-charcoal-950 dark:text-white">
                          {t('settings.transactionHistory') || 'Transaction History'}
                        </h3>
                        <svg
                          className={`w-5 h-5 text-charcoal-600 dark:text-gray-400 transition-transform ${showTransactionHistory ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {showTransactionHistory && (
                        <div className="mt-4 space-y-3 max-h-80 overflow-y-auto">
                          {transactions.map((transaction) => (
                            <div
                              key={transaction.id}
                              className="flex items-center justify-between bg-charcoal-50 dark:bg-navy-700/30 rounded-xl p-3"
                            >
                              <div className="flex items-center gap-3">
                                {getTransactionIcon(transaction.transaction_type, transaction.source)}
                                <div>
                                  <p className="text-sm font-medium text-charcoal-950 dark:text-white">
                                    {transaction.source === 'referral_commission' && (t('settings.referralCommission') || 'Referral Commission')}
                                    {transaction.source === 'course_purchase' && (t('settings.coursePurchase') || 'Course Purchase')}
                                    {transaction.source === 'withdrawal' && (t('settings.withdrawal') || 'Withdrawal')}
                                    {transaction.source === 'admin_adjustment' && (t('settings.adminAdjustment') || 'Admin Adjustment')}
                                  </p>
                                  <p className="text-xs text-charcoal-500 dark:text-gray-400">
                                    {formatDate(transaction.created_at)}
                                  </p>
                                </div>
                              </div>
                              <p className={`text-sm font-bold ${transaction.transaction_type === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {transaction.transaction_type === 'credit' ? '+' : '-'}₾{Math.abs(transaction.amount).toFixed(2)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Withdrawal Requests History */}
                  {withdrawalRequests.length > 0 && (
                    <div className="border-t border-charcoal-200 dark:border-navy-600 pt-6">
                      <h3 className="text-lg font-medium text-charcoal-950 dark:text-white mb-4">
                        {t('settings.withdrawalRequests') || 'Withdrawal Requests'}
                      </h3>
                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {withdrawalRequests.map((request) => (
                          <div
                            key={request.id}
                            className="flex items-center justify-between bg-charcoal-50 dark:bg-navy-700/30 rounded-xl p-3"
                          >
                            <div>
                              <p className="text-sm font-medium text-charcoal-950 dark:text-white">
                                ₾{request.amount.toFixed(2)}
                              </p>
                              <p className="text-xs text-charcoal-500 dark:text-gray-400">
                                {formatDate(request.created_at)}
                              </p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              request.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                              request.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                              request.status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                            }`}>
                              {request.status === 'pending' && (t('settings.statusPending') || 'Pending')}
                              {request.status === 'completed' && (t('settings.statusCompleted') || 'Completed')}
                              {request.status === 'rejected' && (t('settings.statusRejected') || 'Rejected')}
                              {request.status === 'approved' && (t('settings.statusApproved') || 'Approved')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Referral Links Section */}
            {referralCode && (
              <div className="bg-white dark:bg-navy-800 border border-charcoal-100/50 dark:border-navy-700/50 rounded-3xl p-6 shadow-soft">
                <h2 className="text-xl font-semibold text-charcoal-950 dark:text-white mb-4">{t('settings.referralLinks')}</h2>
                <p className="text-sm text-charcoal-600 dark:text-gray-400 mb-6">{t('settings.referralLinksDescription')}</p>
                
                {/* General Referral Link */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-2">
                    {t('settings.generalReferralLink')}
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-charcoal-50 dark:bg-navy-700/50 border border-charcoal-200 dark:border-navy-600 rounded-xl px-4 py-3">
                      <p className="text-sm font-mono text-charcoal-950 dark:text-white break-all">{getReferralLink()}</p>
                    </div>
                    <button
                      onClick={() => handleCopyReferralLink(getReferralLink())}
                      className="px-4 py-3 bg-charcoal-950 dark:bg-emerald-500 text-white font-semibold rounded-xl hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-all duration-200 hover:shadow-soft dark:hover:shadow-glow-dark flex items-center gap-2 whitespace-nowrap"
                    >
                      {copiedLink === getReferralLink() ? (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {t('settings.copied')}
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          {t('settings.copy')}
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Course-Specific Referral Links - Only enrolled courses */}
                {coursesLoading || enrollmentsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
                  </div>
                ) : enrolledCourses.length > 0 ? (
                  <div>
                    <label className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-3">
                      {t('settings.courseSpecificLinks')}
                    </label>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {enrolledCourses.map((course) => {
                        const courseLink = getReferralLink(course.id);
                        return (
                          <div key={course.id} className="bg-charcoal-50 dark:bg-navy-700/30 border border-charcoal-200 dark:border-navy-600 rounded-xl p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-charcoal-950 dark:text-white mb-2">{course.title}</p>
                                <div className="bg-white dark:bg-navy-800 border border-charcoal-200 dark:border-navy-600 rounded-lg px-3 py-2 mt-2">
                                  <p className="text-xs font-mono text-charcoal-700 dark:text-gray-300 break-all">{courseLink}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleCopyReferralLink(courseLink)}
                                className="px-3 py-2 bg-charcoal-950 dark:bg-emerald-500 text-white text-sm font-semibold rounded-lg hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-all duration-200 hover:shadow-soft dark:hover:shadow-glow-dark flex items-center gap-1.5 whitespace-nowrap"
                                title={t('settings.copy')}
                              >
                                {copiedLink === courseLink ? (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="bg-charcoal-50 dark:bg-navy-700/30 border border-charcoal-200 dark:border-navy-600 rounded-xl p-4">
                    <p className="text-sm text-charcoal-600 dark:text-gray-400 text-center">
                      {t('settings.noEnrolledCourses') || 'You need to enroll in courses to generate course-specific referral links.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Password Update Section */}
            <div className="bg-white dark:bg-navy-800 border border-charcoal-100/50 dark:border-navy-700/50 rounded-3xl p-6 shadow-soft">
              <h2 className="text-xl font-semibold text-charcoal-950 dark:text-white mb-4">{t('settings.updatePassword')}</h2>
              <p className="text-sm text-charcoal-600 dark:text-gray-400 mb-6">{t('settings.updatePasswordDescription')}</p>

              <form onSubmit={handlePasswordUpdate} className="space-y-4">
                {/* Current Password */}
                <div>
                  <label className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-2">
                    {t('settings.currentPassword')}
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-navy-700/50 border border-charcoal-200 dark:border-navy-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent text-charcoal-950 dark:text-white placeholder-charcoal-400 dark:placeholder-gray-500"
                    required
                    disabled={isUpdatingPassword}
                  />
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-2">
                    {t('settings.newPassword')}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-navy-700/50 border border-charcoal-200 dark:border-navy-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent text-charcoal-950 dark:text-white placeholder-charcoal-400 dark:placeholder-gray-500"
                    required
                    minLength={6}
                    disabled={isUpdatingPassword}
                  />
                  <p className="text-xs text-charcoal-500 dark:text-gray-400 mt-1">{t('settings.passwordMinLength')}</p>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-2">
                    {t('settings.confirmPassword')}
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-navy-700/50 border border-charcoal-200 dark:border-navy-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent text-charcoal-950 dark:text-white placeholder-charcoal-400 dark:placeholder-gray-500"
                    required
                    minLength={6}
                    disabled={isUpdatingPassword}
                  />
                </div>

                {/* Error Message */}
                {passwordError && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
                    {passwordError}
                  </div>
                )}

                {/* Success Message */}
                {passwordSuccess && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-xl text-sm">
                    {t('settings.passwordUpdatedSuccessfully')}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="w-full md:w-auto px-6 py-3 bg-charcoal-950 dark:bg-emerald-500 text-white font-semibold rounded-xl hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-all duration-200 hover:shadow-soft dark:hover:shadow-glow-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isUpdatingPassword ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('settings.updating')}
                    </>
                  ) : (
                    t('settings.updatePassword')
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

