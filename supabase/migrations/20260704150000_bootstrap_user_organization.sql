-- Allow authenticated users to create a workspace + bootstrap via SECURITY DEFINER RPC

DROP POLICY IF EXISTS "organizations_insert_authenticated" ON public.organizations;
CREATE POLICY "organizations_insert_authenticated"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.bootstrap_user_organization(
  org_name TEXT,
  org_slug TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  org_id UUID;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT om.organization_id INTO org_id
  FROM public.organization_members om
  WHERE om.user_id = uid
  LIMIT 1;

  IF org_id IS NOT NULL THEN
    RETURN org_id;
  END IF;

  INSERT INTO public.organizations (name, slug)
  VALUES (org_name, org_slug)
  RETURNING id INTO org_id;

  -- organizations_bootstrap_owner trigger adds membership + free subscription
  RETURN org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_user_organization(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_user_organization(TEXT, TEXT) TO authenticated;
