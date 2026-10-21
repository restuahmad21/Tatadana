-- ====================================================================
-- Migration 005: Create Calendar Notes Table
-- Supports persistent financial calendar notes with day-level binding
-- Timezone: Asia/Jakarta (WIB)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.calendar_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL, -- Format: YYYY-MM-DD
    title TEXT NOT NULL,
    content TEXT,
    tag TEXT DEFAULT 'Catatan',
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

CREATE INDEX IF NOT EXISTS idx_calendar_notes_user_date ON public.calendar_notes (user_id, date);

-- Enable RLS
ALTER TABLE public.calendar_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own calendar notes" ON public.calendar_notes;
CREATE POLICY "Users can view own calendar notes" ON public.calendar_notes
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own calendar notes" ON public.calendar_notes;
CREATE POLICY "Users can insert own calendar notes" ON public.calendar_notes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own calendar notes" ON public.calendar_notes;
CREATE POLICY "Users can update own calendar notes" ON public.calendar_notes
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own calendar notes" ON public.calendar_notes;
CREATE POLICY "Users can delete own calendar notes" ON public.calendar_notes
    FOR DELETE USING (auth.uid() = user_id);
