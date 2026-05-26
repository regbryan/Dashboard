-- post-videos bucket — mirrors the existing post-images setup.
--
-- Private bucket. Reads happen via short-lived signed URLs minted
-- by the admin client; writes happen only from the /api/render-reel
-- route (admin-gated, service-role key).
--
-- Run once in the Supabase SQL editor. Idempotent.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-videos',
  'post-videos',
  false,
  524288000,                     -- 500 MB ceiling per object
  array['video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do nothing;

-- RLS policies. Service role bypasses these (used by /api/render-reel).
-- Authenticated users can read videos for brands they have access to.

-- Clients can read videos for brands they have access to. Admins
-- typically read via signed URLs minted on the server (service role
-- bypasses RLS), so this policy is just for direct authenticated
-- fetches from the client SDK.

drop policy if exists "post_videos_read_by_brand_access" on storage.objects;
create policy "post_videos_read_by_brand_access"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'post-videos'
    and exists (
      select 1
      from public.user_brand_access uba
      where uba.user_id = auth.uid()
        and uba.brand_id = split_part(name, '/', 1)
    )
  );

-- No insert / update / delete policies for the authenticated role.
-- Only the service-role client (used in /api/render-reel) writes.
