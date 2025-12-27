export interface BalanceTransaction {
  id: string;
  user_id: string;
  user_type: 'student' | 'lecturer' | 'admin';
  amount: number;
  transaction_type: 'credit' | 'debit';
  source: 'referral_commission' | 'course_purchase' | 'withdrawal' | 'admin_adjustment';
  reference_id: string | null;
  reference_type: 'enrollment_request' | 'withdrawal_request' | 'admin_action' | null;
  description: string | null;
  balance_before: number | null;
  balance_after: number | null;
  created_at: string;
}

export interface WithdrawalRequest {
  id: string;
  user_id: string;
  user_type: 'student' | 'lecturer';
  amount: number;
  bank_account_number: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  admin_notes: string | null;
  processed_at: string | null;
  processed_by: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    email: string;
    username: string | null;
    role: string;
    balance: number;
  };
}

export interface BalanceInfo {
  balance: number;
  bankAccountNumber: string | null;
  pendingWithdrawal: number;
  totalEarned: number;
  totalWithdrawn: number;
  transactions: BalanceTransaction[];
}

