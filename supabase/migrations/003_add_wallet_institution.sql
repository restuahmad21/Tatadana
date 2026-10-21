-- Migration 003: Add institution_name to public.wallets for specific bank/e-wallet name
-- Options for bank: BRI, BCA, Mandiri, BNI, BSI
-- Options for e-wallet: DANA, GoPay, ShopeePay, OVO

ALTER TABLE public.wallets 
ADD COLUMN IF NOT EXISTS institution_name TEXT;

COMMENT ON COLUMN public.wallets.institution_name IS 'Nama spesifik bank (BRI, BCA, Mandiri, BNI, BSI) atau e-wallet (DANA, GoPay, ShopeePay, OVO)';
