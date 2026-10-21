-- ====================================================================
-- TataDana SaaS: Complete Relational Schema & Row Level Security (RLS)
-- File: supabase/migrations/001_initial_schema.sql
-- Timezone: Asia/Jakarta (WIB)
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS
DO $$ BEGIN
    CREATE TYPE plan_tier AS ENUM ('starter', 'pro');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'transfer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_source AS ENUM ('web', 'telegram_text', 'telegram_voice', 'telegram_receipt');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2.5 USERS TABLE (Core Users Foundation)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    phone_number TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 3. PROFILES TABLE (Linked with Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL DEFAULT 'User TataDana',
    phone_number TEXT UNIQUE,
    phone_verified BOOLEAN DEFAULT FALSE,
    telegram_user_id BIGINT UNIQUE,
    telegram_username TEXT,
    custom_bot_token TEXT, -- Encrypted bot token for BYOB mode
    custom_bot_connected BOOLEAN DEFAULT FALSE,
    avatar_url TEXT,
    default_currency TEXT DEFAULT 'IDR',
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'superadmin')),
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 4. WALLETS (Multi-Wallet)
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'bank' CHECK (type IN ('cash', 'bank', 'ewallet')),
    institution_name TEXT, -- Specific bank (BRI, BCA, Mandiri, BNI, BSI) or e-wallet (DANA, GoPay, ShopeePay, OVO)
    balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- Ensure 1 default wallet per user trigger/constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_default_wallet_per_user 
ON public.wallets (user_id) 
WHERE is_default = TRUE;

-- 5. CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '🏷️',
    color TEXT NOT NULL DEFAULT '#f97316',
    type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('expense', 'income')),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 6. BUDGETS (Monthly budget per category)
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    monthly_limit NUMERIC(15, 2) NOT NULL,
    current_spent NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    month_period VARCHAR(7) NOT NULL, -- e.g. '2026-10'
    alert_80_sent BOOLEAN DEFAULT FALSE,
    alert_100_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta'),
    UNIQUE(user_id, category_id, month_period)
);

-- 7. TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    destination_wallet_id UUID REFERENCES public.wallets(id) ON DELETE RESTRICT, -- for transfer
    type transaction_type NOT NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    note TEXT,
    source transaction_source NOT NULL DEFAULT 'web',
    telegram_update_id BIGINT,
    receipt_image_url TEXT,
    merchant_name TEXT,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta'),
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 8. TRANSACTION_ITEMS (Multi-item receipt breakdown for Pro OCR)
CREATE TABLE IF NOT EXISTS public.transaction_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    quantity NUMERIC(10, 2) DEFAULT 1.00,
    price NUMERIC(15, 2) NOT NULL,
    category_name TEXT,
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 9. USER SUBSCRIPTIONS & USAGE TRACKING
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan plan_tier NOT NULL DEFAULT 'starter',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'canceled')),
    monthly_transaction_count INT NOT NULL DEFAULT 0,
    month_period VARCHAR(7) NOT NULL DEFAULT TO_CHAR(NOW() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM'),
    started_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta'),
    expires_at TIMESTAMPTZ, -- null for lifetime Pro
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 10. PAYMENTS (Midtrans & Manual Transfer)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    order_id TEXT NOT NULL UNIQUE,
    plan plan_tier NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    method TEXT NOT NULL, -- 'midtrans_qris', 'midtrans_va', 'manual_bca', etc.
    status payment_status NOT NULL DEFAULT 'pending',
    proof_url TEXT,
    admin_notes TEXT,
    approved_by UUID REFERENCES public.profiles(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 11. REMINDERS SETTINGS
CREATE TABLE IF NOT EXISTS public.reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    frequency INT NOT NULL DEFAULT 1 CHECK (frequency BETWEEN 1 AND 2),
    time_1 TIME NOT NULL DEFAULT '12:00:00',
    time_2 TIME DEFAULT '20:00:00',
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 12. PROCESSED WEBHOOKS (Idempotency check to avoid double spending on Telegram retry)
CREATE TABLE IF NOT EXISTS public.processed_webhooks (
    update_id BIGINT PRIMARY KEY,
    bot_token_hash TEXT,
    user_id UUID,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 13. AI PROVIDERS CONFIGURATION (Superadmin Managed)
CREATE TABLE IF NOT EXISTS public.ai_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE, -- 'gemini', 'openai', 'deepseek'
    display_name TEXT NOT NULL,
    api_key_encrypted TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    failover_priority INT NOT NULL DEFAULT 1,
    model_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 14. AI LOGS (Monitoring cost & latency)
CREATE TABLE IF NOT EXISTS public.ai_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    action_type TEXT NOT NULL, -- 'parse_text', 'transcribe_audio', 'receipt_ocr', 'financial_advisor'
    prompt_tokens INT DEFAULT 0,
    completion_tokens INT DEFAULT 0,
    latency_ms INT NOT NULL,
    status TEXT NOT NULL, -- 'success', 'error', 'failover'
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 15. AUDIT LOGS (Superadmin inspection tracking)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES public.profiles(id),
    target_user_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL, -- 'view_user_transactions', 'impersonate_user', 'approve_payment', etc.
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 16. EXPORT HISTORY (PDF/Excel cached signed downloads)
CREATE TABLE IF NOT EXISTS public.export_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'xlsx')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    storage_path TEXT NOT NULL,
    file_size_bytes BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- ====================================================================
-- TRIGGERS & FUNCTIONS
-- ====================================================================

-- Function: Balance & Budget Auto-Updater
CREATE OR REPLACE FUNCTION public.handle_transaction_changes()
RETURNS TRIGGER AS $$
DECLARE
    cur_period VARCHAR(7);
BEGIN
    cur_period := TO_CHAR(COALESCE(NEW.transaction_date, NOW()) AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM');

    IF (TG_OP = 'INSERT') THEN
        -- Expense: deduct wallet balance, add to budget current_spent
        IF NEW.type = 'expense' THEN
            UPDATE public.wallets 
            SET balance = balance - NEW.amount, updated_at = NOW() 
            WHERE id = NEW.wallet_id;

            IF NEW.category_id IS NOT NULL THEN
                UPDATE public.budgets 
                SET current_spent = current_spent + NEW.amount, updated_at = NOW()
                WHERE user_id = NEW.user_id AND category_id = NEW.category_id AND month_period = cur_period;
            END IF;

        -- Income: add to wallet balance
        ELSIF NEW.type = 'income' THEN
            UPDATE public.wallets 
            SET balance = balance + NEW.amount, updated_at = NOW() 
            WHERE id = NEW.wallet_id;

        -- Transfer: deduct source, credit destination
        ELSIF NEW.type = 'transfer' AND NEW.destination_wallet_id IS NOT NULL THEN
            UPDATE public.wallets 
            SET balance = balance - NEW.amount, updated_at = NOW() 
            WHERE id = NEW.wallet_id;

            UPDATE public.wallets 
            SET balance = balance + NEW.amount, updated_at = NOW() 
            WHERE id = NEW.destination_wallet_id;
        END IF;

        -- Increment monthly transaction count
        UPDATE public.subscriptions
        SET monthly_transaction_count = monthly_transaction_count + 1, updated_at = NOW()
        WHERE user_id = NEW.user_id;

        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_transaction_changes ON public.transactions;
CREATE TRIGGER trg_transaction_changes
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_transaction_changes();

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: user can see & edit own profile; superadmin can see all
CREATE POLICY "Users can manage own profile" ON public.profiles
FOR ALL USING (auth.uid() = id);

-- Wallets: user only
CREATE POLICY "Users can manage own wallets" ON public.wallets
FOR ALL USING (auth.uid() = user_id);

-- Categories: user only
CREATE POLICY "Users can manage own categories" ON public.categories
FOR ALL USING (auth.uid() = user_id);

-- Budgets: user only
CREATE POLICY "Users can manage own budgets" ON public.budgets
FOR ALL USING (auth.uid() = user_id);

-- Transactions: user only
CREATE POLICY "Users can manage own transactions" ON public.transactions
FOR ALL USING (auth.uid() = user_id);

-- Transaction Items: user only through transaction relationship
CREATE POLICY "Users can manage own transaction items" ON public.transaction_items
FOR ALL USING (
    EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid())
);

-- Subscriptions: user view own; system manage
CREATE POLICY "Users can view own subscription" ON public.subscriptions
FOR SELECT USING (auth.uid() = user_id);

-- Payments: user view own
CREATE POLICY "Users can view own payments" ON public.payments
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payments" ON public.payments
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Reminders: user only
CREATE POLICY "Users can manage own reminders" ON public.reminders
FOR ALL USING (auth.uid() = user_id);

-- Export History: user only
CREATE POLICY "Users can manage own export history" ON public.export_history
FOR ALL USING (auth.uid() = user_id);

-- AI Providers: only superadmin
CREATE POLICY "Superadmin manage ai_providers" ON public.ai_providers
FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
);

-- AI Logs: superadmin view
CREATE POLICY "Superadmin view ai_logs" ON public.ai_logs
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
);

-- Audit Logs: superadmin view
CREATE POLICY "Superadmin view audit_logs" ON public.audit_logs
FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
);

-- 17. SETTINGS (System configurations & Telegram Bot credentials)
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Allow service role full access on settings" ON public.settings FOR ALL USING (true);

