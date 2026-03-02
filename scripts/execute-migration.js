#!/usr/bin/env node

const { Pool } = require('pg');

const migrationSQL = `
-- Migration 100: Fix RLS Policies for Lecturer Course Creation Uploads
-- Drop existing INSERT policies
DROP POLICY IF EXISTS "Lecturers can upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers can upload thumbnails" ON storage.objects;

-- Remove file size limits
UPDATE storage.buckets SET file_size_limit = NULL
WHERE id IN ('course-videos', 'course-thumbnails');

-- New INSERT policy for course-videos
CREATE POLICY "Lecturers can upload videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'course-videos' AND
  auth.role() = 'authenticated' AND
  (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id::text = (storage.foldername(name))[1]
      AND courses.lecturer_id = auth.uid()
    )
    OR
    (
      (storage.foldername(name))[1] = auth.uid()::text AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'lecturer'
      )
    )
  )
);

-- New INSERT policy for course-thumbnails
CREATE POLICY "Lecturers can upload thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'course-thumbnails' AND
  auth.role() = 'authenticated' AND
  (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id::text = (storage.foldername(name))[1]
      AND courses.lecturer_id = auth.uid()
    )
    OR
    (
      (storage.foldername(name))[1] = auth.uid()::text AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'lecturer'
      )
    )
  )
);
`;

async function runMigration() {
  const pool = new Pool({
    host: process.env.SUPABASE_DB_HOST,
    port: process.env.SUPABASE_DB_PORT,
    user: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    database: process.env.SUPABASE_DB_NAME,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    console.log('🚀 Connecting to Supabase staging database...');
    console.log(`   Host: ${process.env.SUPABASE_DB_HOST}`);
    console.log(`   Project: ${process.env.SUPABASE_PROJECT_ID}`);

    const client = await pool.connect();
    console.log('✅ Connected successfully\n');

    console.log('📝 Executing Migration 100...');
    console.log('   • Dropping old INSERT policies');
    console.log('   • Removing file size limits');
    console.log('   • Creating new RLS policies with OR condition');

    await client.query(migrationSQL);

    console.log('\n✅ Migration 100 applied successfully!');
    console.log('   ✓ RLS policies updated');
    console.log('   ✓ File size limits removed');
    console.log('   ✓ Both course creation and existing uploads supported\n');

    client.release();
    await pool.end();

    console.log('🎉 Ready to test:');
    console.log('   1. Log in as lecturer');
    console.log('   2. Create Course → Step 3 (Media)');
    console.log('   3. Upload thumbnail → should succeed');
    console.log('   4. Upload video → should succeed');

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (err.detail) console.error('   Details:', err.detail);
    await pool.end();
    process.exit(1);
  }
}

if (!process.env.SUPABASE_DB_PASSWORD) {
  console.error('❌ Missing .env.supabase file');
  console.error('   Create .env.supabase with database credentials');
  process.exit(1);
}

runMigration();
