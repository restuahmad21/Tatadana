'use client';

import { 
  Profile, 
  Wallet, 
  Category, 
  Budget, 
  Transaction, 
  Subscription, 
  AIProviderConfig, 
  AILog, 
  AuditLog, 
  PaymentOrder, 
  ReminderSetting 
} from './types';
import { 
  INITIAL_USER, 
  INITIAL_WALLETS, 
  INITIAL_CATEGORIES, 
  INITIAL_BUDGETS, 
  INITIAL_TRANSACTIONS, 
  INITIAL_SUBSCRIPTION, 
  INITIAL_REMINDER, 
  INITIAL_AI_PROVIDERS, 
  INITIAL_AI_LOGS, 
  INITIAL_PAYMENTS, 
  INITIAL_AUDIT_LOGS 
} from './mock-data';

const STORAGE_KEY = 'tatadana_state_v1';

export interface AppState {
  user: Profile;
  wallets: Wallet[];
  categories: Category[];
  budgets: Budget[];
  transactions: Transaction[];
  subscription: Subscription;
  reminder: ReminderSetting;
  aiProviders: AIProviderConfig[];
  aiLogs: AILog[];
  payments: PaymentOrder[];
  auditLogs: AuditLog[];
  impersonatingUser: Profile | null;
}

export function getInitialState(): AppState {
  if (typeof window === 'undefined') {
    return {
      user: INITIAL_USER,
      wallets: INITIAL_WALLETS,
      categories: INITIAL_CATEGORIES,
      budgets: INITIAL_BUDGETS,
      transactions: INITIAL_TRANSACTIONS,
      subscription: INITIAL_SUBSCRIPTION,
      reminder: INITIAL_REMINDER,
      aiProviders: INITIAL_AI_PROVIDERS,
      aiLogs: INITIAL_AI_LOGS,
      payments: INITIAL_PAYMENTS,
      auditLogs: INITIAL_AUDIT_LOGS,
      impersonatingUser: null,
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed reading state from localStorage', err);
  }

  const fresh: AppState = {
    user: INITIAL_USER,
    wallets: INITIAL_WALLETS,
    categories: INITIAL_CATEGORIES,
    budgets: INITIAL_BUDGETS,
    transactions: INITIAL_TRANSACTIONS,
    subscription: INITIAL_SUBSCRIPTION,
    reminder: INITIAL_REMINDER,
    aiProviders: INITIAL_AI_PROVIDERS,
    aiLogs: INITIAL_AI_LOGS,
    payments: INITIAL_PAYMENTS,
    auditLogs: INITIAL_AUDIT_LOGS,
    impersonatingUser: null,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

export function saveState(state: AppState) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      // Dispatch custom event for real-time reactive sync across components
      window.dispatchEvent(new Event('tatadana_state_changed'));
    } catch (err) {
      console.error('Failed saving state to localStorage', err);
    }
  }
}
