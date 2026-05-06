ALTER FUNCTION public.decrypt_pii(text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.encrypt_pii(text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.set_project_pending_payment_if_required()
  SET search_path = public, pg_catalog, pg_temp;
