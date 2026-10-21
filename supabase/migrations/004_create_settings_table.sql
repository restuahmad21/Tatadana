-- ====================================================================
-- Migration 004: Create Settings Table for System & Telegram Bot Configuration
-- Supports persistent storage of API tokens, Telegram credentials, and app preferences
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial Telegram Bot Token configuration for Long Polling
INSERT INTO public.settings (key, value, description)
VALUES ('telegram_bot_token', '849302194:AAHF1a9XmZ0kdq-38Z9eY14mKp03', 'Telegram Bot API Token for Localhost Long Polling')
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value, 
    updated_at = NOW();

-- Enable Row Level Security (RLS)
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Allow public read on settings table
DROP POLICY IF EXISTS "Allow public read on settings" ON public.settings;
CREATE POLICY "Allow public read on settings" ON public.settings
    FOR SELECT USING (true);

-- Allow service role full access
DROP POLICY IF EXISTS "Allow service role full access on settings" ON public.settings;
CREATE POLICY "Allow service role full access on settings" ON public.settings
    FOR ALL USING (true);
