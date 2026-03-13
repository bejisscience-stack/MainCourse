'use client';

import { useI18n } from '@/contexts/I18nContext';

interface PaymentMethodSelectorProps {
  selectedMethod: 'keepz' | 'bank_transfer';
  onSelect: (method: 'keepz' | 'bank_transfer') => void;
  amount?: number;
  disabled?: boolean;
}

export default function PaymentMethodSelector({
  selectedMethod,
  onSelect,
  disabled,
}: PaymentMethodSelectorProps) {
  const { t } = useI18n();

  return (
    <div>
      <label className="block text-sm font-semibold mb-2 text-gray-300">
        {t('paymentMethod.chooseMethod')}
      </label>
      <div className="grid grid-cols-2 gap-3">
        {/* Card Payment */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect('keepz')}
          className={`relative p-4 rounded-xl border-2 transition-all text-left ${
            selectedMethod === 'keepz'
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-navy-700 bg-navy-800/50 hover:border-navy-600'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
            {t('paymentMethod.instant')}
          </span>
          <svg className="w-6 h-6 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <p className="text-sm font-semibold text-white">{t('paymentMethod.cardPayment')}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('paymentMethod.visaMastercard')}</p>
        </button>

        {/* Bank Transfer */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect('bank_transfer')}
          className={`relative p-4 rounded-xl border-2 transition-all text-left ${
            selectedMethod === 'bank_transfer'
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-navy-700 bg-navy-800/50 hover:border-navy-600'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-400">
            {t('paymentMethod.manualProcessing')}
          </span>
          <svg className="w-6 h-6 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <p className="text-sm font-semibold text-white">{t('paymentMethod.bankTransfer')}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('paymentMethod.manualTransfer')}</p>
        </button>
      </div>
    </div>
  );
}
