-- ─── Migration: Add "brew" app_id to the platform ────────────────────────────
-- Run this in your Supabase SQL editor alongside existing migrations.
-- The shared-types AppId union already includes "brew" — this migration
-- ensures any DB-level app_id constraints also accept it.

-- If you have a check constraint on app_id in places or reviews, update it:
-- (Skip if your schema uses the TypeScript union only and has no DB constraint)

-- Update places app_id check if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'places_app_id_check'
  ) THEN
    ALTER TABLE places DROP CONSTRAINT places_app_id_check;
    ALTER TABLE places ADD CONSTRAINT places_app_id_check
      CHECK (app_id IN ('boba', 'brew', 'slice', 'ramen', 'pizza'));
  END IF;
END $$;

-- Update reviews app_id check if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'reviews_app_id_check'
  ) THEN
    ALTER TABLE reviews DROP CONSTRAINT reviews_app_id_check;
    ALTER TABLE reviews ADD CONSTRAINT reviews_app_id_check
      CHECK (app_id IN ('boba', 'brew', 'slice', 'ramen', 'pizza'));
  END IF;
END $$;

-- Update app_memberships app_id check if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'app_memberships_app_id_check'
  ) THEN
    ALTER TABLE app_memberships DROP CONSTRAINT app_memberships_app_id_check;
    ALTER TABLE app_memberships ADD CONSTRAINT app_memberships_app_id_check
      CHECK (app_id IN ('boba', 'brew', 'slice', 'ramen', 'pizza'));
  END IF;
END $$;

-- Ensure the review-images storage bucket exists (for photo uploads)
INSERT INTO storage.buckets (id, name, public)
VALUES ('review-images', 'review-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload to their own folder
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE polname = 'Users can upload review images'
      AND polrelid = 'storage.objects'::regclass
  ) THEN
    CREATE POLICY "Users can upload review images"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'review-images'
        AND auth.role() = 'authenticated'
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE polname = 'Review images are publicly readable'
      AND polrelid = 'storage.objects'::regclass
  ) THEN
    CREATE POLICY "Review images are publicly readable"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'review-images');
  END IF;
END $$;
