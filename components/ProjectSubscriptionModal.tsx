'use client';

import { useState } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { useProjectAccess } from '@/hooks/useProjectAccess';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from 'sonner';

interface ProjectSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  courseId?: string;
}

const SUBSCRIPTION_PRICE = 10.0;

/**
 * Modal for project subscription purchase workflow.
 * 4 views:
 * 1. Status (if pending/active/rejected)
 * 2. Payment (default)
 * 3. Loading
 * 4. Error
 */
export default function ProjectSubscriptionModal({
  isOpen,
  onClose,
  onSuccess,
  courseId,
}: ProjectSubscriptionModalProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const { user } = useUser();
  const { subscription, hasActiveSubscription } = useProjectAccess(user?.id);

  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Show status view if user has existing subscription
  if (subscription) {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 bg-navy-950/80 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-navy-900/95 border border-navy-800/60 rounded-2xl shadow-soft-xl p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-200"
          >
            ✕
          </button>
          <h2 className="text-2xl font-bold text-white mb-4">{t('projectSubscription')}</h2>
        <div className="space-y-4">
          {subscription.status === 'pending' && (
            <div className={`p-4 rounded-lg border-2 ${
              theme.theme === 'dark' ? 'border-blue-500 bg-blue-500/10' : 'border-blue-400 bg-blue-50'
            }`}>
              <p className={`text-sm font-semibold ${theme.theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
                {t('pendingApproval')}
              </p>
              <p className={`text-xs ${theme.theme === 'dark' ? 'text-blue-200' : 'text-blue-600'} mt-1`}>
                {t('subscriptionPendingMessage')}
              </p>
            </div>
          )}

          {subscription.status === 'active' && subscription.expires_at && (
            <div className={`p-4 rounded-lg border-2 ${
              theme.theme === 'dark' ? 'border-green-500 bg-green-500/10' : 'border-green-400 bg-green-50'
            }`}>
              <p className={`text-sm font-semibold ${theme.theme === 'dark' ? 'text-green-300' : 'text-green-700'}`}>
                {t('subscriptionActive')}
              </p>
              <p className={`text-xs ${theme.theme === 'dark' ? 'text-green-200' : 'text-green-600'} mt-1`}>
                {t('expiresOn')} {new Date(subscription.expires_at).toLocaleDateString()}
              </p>
            </div>
          )}

          {subscription.status === 'rejected' && (
            <div className={`p-4 rounded-lg border-2 ${
              theme.theme === 'dark' ? 'border-red-500 bg-red-500/10' : 'border-red-400 bg-red-50'
            }`}>
              <p className={`text-sm font-semibold ${theme.theme === 'dark' ? 'text-red-300' : 'text-red-700'}`}>
                {t('subscriptionRejected')}
              </p>
              <p className={`text-xs ${theme.theme === 'dark' ? 'text-red-200' : 'text-red-600'} mt-2`}>
                {t('subscriptionRejectedMessage')}
              </p>
            </div>
          )}

          <button onClick={onClose} className="w-full px-4 py-2 bg-navy-800/70 text-gray-300 rounded-lg hover:bg-navy-700 font-semibold">
            {t('close')}
          </button>
        </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleKeepzPayment = async () => {
    setIsRedirecting(true);
    setError(null);
    try {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const { data: { session: refreshed } } = await supabase.auth.refreshSession();
        session = refreshed;
      }
      if (!session?.access_token) throw new Error('Not authenticated');
      const token = session.access_token;

      // Create subscription request with keepz payment method
      const subResponse = await fetch('/api/project-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ payment_method: 'keepz' }),
      });
      if (!subResponse.ok) {
        const errData = await subResponse.json();
        throw new Error(errData.error || 'Failed to create subscription');
      }
      const subscription = await subResponse.json();

      // Create Keepz order
      const orderResponse = await fetch('/api/payments/keepz/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ paymentType: 'project_subscription', referenceId: subscription.id }),
      });
      if (!orderResponse.ok) {
        const errData = await orderResponse.json();
        throw new Error(errData.error || 'Failed to create payment');
      }
      const { checkoutUrl } = await orderResponse.json();

      window.location.href = checkoutUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      setError(message);
      setIsRedirecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-navy-950/80 z-50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-navy-900/95 border border-navy-800/60 rounded-2xl shadow-soft-xl p-6 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-200"
        >
          ✕
        </button>
        <h2 className="text-2xl font-bold text-white mb-6">{t('projectSubscription')}</h2>
      <div className="space-y-6">
        {/* Price Display */}
        <div className={`text-center p-4 rounded-lg ${theme.theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            {t('subscriptionPrice')}
          </p>
          <p className="text-3xl font-bold text-emerald-600">₾{SUBSCRIPTION_PRICE.toFixed(2)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">per month</p>
        </div>

        {/* Pay with Keepz */}
        <button
          onClick={handleKeepzPayment}
          disabled={isRedirecting}
          className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold disabled:opacity-50 text-lg"
        >
          {isRedirecting ? t('paymentMethod.redirecting') : t('paymentMethod.payWithCard', { amount: `₾${SUBSCRIPTION_PRICE.toFixed(2)}` })}
        </button>

        {/* Error Message */}
        {error && (
          <div className={`p-3 rounded-lg border ${
            theme.theme === 'dark'
              ? 'border-red-500/50 bg-red-500/10 text-red-300'
              : 'border-red-400 bg-red-50 text-red-700'
          }`}>
            <p className="text-sm">{error}</p>
          </div>
        )}

      </div>
      </div>
    </div>
  );
}
