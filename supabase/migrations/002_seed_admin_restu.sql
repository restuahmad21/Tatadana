-- ====================================================================
-- TataDana SaaS: Seeder Akun Administrator 'Restu Ahmad Hidayat'
-- File: supabase/migrations/002_seed_admin_restu.sql
-- Kredensial Permanen:
--   Nama         : Restu Ahmad Hidayat
--   Email/User   : restu21@tatadana.com (alias: restu@tatadana.id)
--   Password     : restuahmad21 (alias: Restu21!)
--   Nomor HP     : 083194703373
--   Role         : superadmin (Admin)
--   Status       : Approved (Bypass Approval)
-- ====================================================================

DO $$
DECLARE
    new_admin_id UUID := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
BEGIN
    -- 1. Insert ke auth.users jika tabel auth.users tersedia (Supabase Auth)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            phone,
            phone_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            role,
            confirmation_token
        ) VALUES (
            new_admin_id,
            '00000000-0000-0000-0000-000000000000',
            'restu21@tatadana.com',
            crypt('restuahmad21', gen_salt('bf')),
            NOW() AT TIME ZONE 'Asia/Jakarta',
            '083194703373',
            NOW() AT TIME ZONE 'Asia/Jakarta',
            '{"provider":"email","providers":["email"],"role":"superadmin"}',
            '{"full_name":"Restu Ahmad Hidayat","role":"admin"}',
            NOW() AT TIME ZONE 'Asia/Jakarta',
            NOW() AT TIME ZONE 'Asia/Jakarta',
            'authenticated',
            ''
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            encrypted_password = EXCLUDED.encrypted_password,
            phone = EXCLUDED.phone,
            updated_at = NOW() AT TIME ZONE 'Asia/Jakarta';
    END IF;

    -- 1b. Insert ke public.users (Core Users Foundation)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        INSERT INTO public.users (
            id,
            email,
            password_hash,
            full_name,
            role,
            phone_number,
            created_at,
            updated_at
        ) VALUES (
            new_admin_id,
            'restu21@tatadana.com',
            crypt('restuahmad21', gen_salt('bf')),
            'Restu Ahmad Hidayat',
            'admin',
            '083194703373',
            NOW() AT TIME ZONE 'Asia/Jakarta',
            NOW() AT TIME ZONE 'Asia/Jakarta'
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            role = 'admin',
            updated_at = NOW() AT TIME ZONE 'Asia/Jakarta';
    END IF;

    -- 2. Insert ke public.profiles
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        INSERT INTO public.profiles (
            id,
            full_name,
            phone_number,
            phone_verified,
            telegram_username,
            avatar_url,
            default_currency,
            role,
            created_at,
            updated_at
        ) VALUES (
            new_admin_id,
            'Restu Ahmad Hidayat',
            '083194703373',
            TRUE,
            '@restuahmad_admin',
            '/uploads/avatars/default-avatar.svg',
            'IDR',
            'superadmin',
            NOW() AT TIME ZONE 'Asia/Jakarta',
            NOW() AT TIME ZONE 'Asia/Jakarta'
        )
        ON CONFLICT (id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            phone_number = EXCLUDED.phone_number,
            phone_verified = TRUE,
            role = 'superadmin',
            updated_at = NOW() AT TIME ZONE 'Asia/Jakarta';
    END IF;

    RAISE NOTICE '✅ Seeder Admin Restu Ahmad Hidayat (restu21@tatadana.com) berhasil disiapkan!';
END $$;
