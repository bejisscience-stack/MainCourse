# Fix for Enrollment Requests Not Showing on Admin Dashboard

## Root Causes Identified

1. **STABLE function caching** - The RPC function was marked as STABLE, causing PostgreSQL to cache results
2. **Missing server-side logs** - Need to see what database actually returns
3. **Approve endpoint 500 error** - Need to fix error handling

## Migrations to Run (IN ORDER)

### 1. Migration 042: Fix RPC Function (CRITICAL - Run First)
```sql
DROP FUNCTION IF EXISTS public.get_enrollment_requests_admin(TEXT);

CREATE OR REPLACE FUNCTION public.get_enrollment_requests_admin(filter_status TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  course_id UUID,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  payment_screenshots JSONB
) AS $$
BEGIN
  IF NOT public.check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can access enrollment requests';
  END IF;

  IF filter_status IS NULL OR filter_status = '' OR filter_status = 'all' THEN
    RETURN QUERY
    SELECT 
      er.id, er.user_id, er.course_id, er.status,
      er.created_at, er.updated_at, er.reviewed_by, er.reviewed_at,
      COALESCE(er.payment_screenshots, '[]'::jsonb) as payment_screenshots
    FROM public.enrollment_requests er
    ORDER BY er.created_at DESC;
  ELSE
    RETURN QUERY
    SELECT 
      er.id, er.user_id, er.course_id, er.status,
      er.created_at, er.updated_at, er.reviewed_by, er.reviewed_at,
      COALESCE(er.payment_screenshots, '[]'::jsonb) as payment_screenshots
    FROM public.enrollment_requests er
    WHERE er.status = filter_status
    ORDER BY er.created_at DESC;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = public;
```

### 2. Migration 043: Add Count Function (Optional but helpful)
```sql
CREATE OR REPLACE FUNCTION public.get_enrollment_requests_count()
RETURNS TABLE (
  total_count BIGINT,
  pending_count BIGINT,
  approved_count BIGINT,
  rejected_count BIGINT
) AS $$
BEGIN
  IF NOT public.check_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can access enrollment request counts';
  END IF;

  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_count,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending_count,
    COUNT(*) FILTER (WHERE status = 'approved')::BIGINT as approved_count,
    COUNT(*) FILTER (WHERE status = 'rejected')::BIGINT as rejected_count
  FROM public.enrollment_requests;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = public;
```

### 3. Migration 040 & 041: Update Approve/Reject Functions (If not already run)
See previous migrations for these.

## Verification Steps

1. **Check Database Directly:**
   ```sql
   SELECT id, user_id, course_id, status, created_at 
   FROM enrollment_requests 
   ORDER BY created_at DESC;
   ```

2. **Test RPC Function:**
   ```sql
   SELECT * FROM get_enrollment_requests_admin(NULL);
   SELECT * FROM get_enrollment_requests_admin('pending');
   ```

3. **Check Counts:**
   ```sql
   SELECT * FROM get_enrollment_requests_count();
   ```

## What Was Fixed

1. ✅ Changed STABLE to VOLATILE - prevents caching
2. ✅ Added comprehensive logging
3. ✅ Added test endpoint for debugging
4. ✅ Improved error handling in approve endpoint
5. ✅ Added count function for verification

## Next Steps

1. Run migrations 042 and 043
2. Click "Test DB" button on admin dashboard
3. Check browser console for detailed logs
4. Verify all requests appear









