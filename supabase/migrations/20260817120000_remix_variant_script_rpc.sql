-- Phase 5 (revise_remix): atomic single-variant script write.
-- Applied BY HAND via the SQL editor (supabase db push is unsafe here — ledger drift).
create or replace function public.remix_blueprint_set_variant_script(
  p_id text,
  p_user_id uuid,
  p_variant int,
  p_script jsonb
) returns void
language sql
set search_path = public, pg_temp
as $$
  update public.remix_blueprints
  set script = jsonb_set(script, array[p_variant::text], p_script)
  where id = p_id and user_id = p_user_id;
$$;
