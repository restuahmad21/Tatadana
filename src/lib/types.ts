// TypeScript Definitions for TataDana Fintech SaaS

export type PlanTier = 'starter' | 'pro';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionSource = 'web' | 'telegram_text' | 'telegram_voice' | 'telegram_receipt';
export type PaymentStatus = 'pending' | 'approved' | 'rejected';
export type AIProviderName = 'gemini' | 'openai' | 'deepseek';

export interface Profile {
  id: string;
  full_name: string;
  phone_number: string;
  phone_verified: boolean;
  telegram_user_id?: number | null;
  telegram_username?: string | null;
  custom_bot_token?: string | null;
  custom_bot_connected?: boolean;
  avatar_url?: string;
  default_currency: string;
  role: 'user' | 'superadmin';
  created_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  name: string;
  type: 'cash' | 'bank' | 'ewallet';
  balance: number;
  is_default: boolean;
  is_active: boolean;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  color: string;
  type: 'expense' | 'income';
  is_default: boolean;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  category_name?: string;
  category_emoji?: string;
  category_color?: string;
  monthly_limit: number;
  current_spent: number;
  month_period: string; // YYYY-MM
  alert_80_sent?: boolean;
  alert_100_sent?: boolean;
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  item_name: string;
  quantity: number;
  price: number;
  category_name?: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  wallet_id: string;
  wallet_name?: string;
  category_id?: string;
  category_name?: string;
  category_emoji?: string;
  destination_wallet_id?: string;
  destination_wallet_name?: string;
  type: TransactionType;
  amount: number;
  note?: string;
  source: TransactionSource;
  telegram_update_id?: number;
  receipt_image_url?: string;
  merchant_name?: string;
  items?: TransactionItem[];
  transaction_date: string; // ISO string in WIB
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: PlanTier;
  status: 'active' | 'expired' | 'canceled';
  monthly_transaction_count: number;
  month_period: string;
  started_at: string;
  expires_at?: string | null;
}

export interface AIProviderConfig {
  id: string;
  name: AIProviderName;
  display_name: string;
  model_name: string;
  api_key_encrypted: string;
  is_active: boolean;
  is_primary: boolean;
  failover_priority: number;
  latency_ms: number;
  failure_count: number;
}

export interface AILog {
  id: string;
  user_id?: string;
  user_name?: string;
  provider: string;
  action_type: 'parse_text' | 'transcribe_audio' | 'receipt_ocr' | 'financial_advisor';
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number;
  status: 'success' | 'error' | 'failover';
  error_message?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  admin_id: string;
  admin_name?: string;
  target_user_id: string;
  target_user_name?: string;
  action: string;
  details?: Record<string, any>;
  created_at: string;
}

export interface PaymentOrder {
  id: string;
  user_id: string;
  user_name?: string;
  order_id: string;
  plan: PlanTier;
  amount: number;
  method: string;
  status: PaymentStatus;
  proof_url?: string;
  admin_notes?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
}

export interface ReminderSetting {
  id: string;
  user_id: string;
  is_enabled: boolean;
  frequency: 1 | 2;
  time_1: string; // HH:mm
  time_2: string; // HH:mm
}

export type ApprovalCategory = 'plan_upgrade' | 'wallet_topup' | 'budget_custom';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalRequest {
  id: string;
  user_id: string;
  user_name: string;
  category: ApprovalCategory;
  category_label: string;
  title: string;
  description: string;
  amount: number;
  details?: Record<string, any>;
  status: ApprovalStatus;
  admin_notes?: string | null;
  created_at: string;
  processed_at?: string | null;
  processed_by?: string | null;
}

