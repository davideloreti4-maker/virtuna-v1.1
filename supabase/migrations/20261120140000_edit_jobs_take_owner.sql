-- =========================================================================
-- An edit job names only its own creator's take (worker plan, Task 6, X70)
--
-- edit_jobs.take_id referred to edit_takes(id) alone, so a job row could name
-- another creator's take, and a worker that trusted it could write that take.
-- The worker now writes a take only with the job's user in its filter; here the
-- database holds it too: a job's (take_id, user_id) must be a take's (id, user_id).
-- A render job has no take (take_id NULL), which a composite key does not check.
-- Deleting a take still deletes its jobs.
-- =========================================================================

-- What the composite key refers to (id alone is already unique; this names the pair).
ALTER TABLE public.edit_jobs DROP CONSTRAINT IF EXISTS edit_jobs_take_owner_fkey;
ALTER TABLE public.edit_takes DROP CONSTRAINT IF EXISTS edit_takes_id_user_key;
ALTER TABLE public.edit_takes ADD CONSTRAINT edit_takes_id_user_key UNIQUE (id, user_id);

-- The key on the take alone gives way to the key on the take and its creator.
ALTER TABLE public.edit_jobs DROP CONSTRAINT IF EXISTS edit_jobs_take_id_fkey;
ALTER TABLE public.edit_jobs ADD CONSTRAINT edit_jobs_take_owner_fkey
  FOREIGN KEY (take_id, user_id) REFERENCES public.edit_takes (id, user_id) ON DELETE CASCADE;
