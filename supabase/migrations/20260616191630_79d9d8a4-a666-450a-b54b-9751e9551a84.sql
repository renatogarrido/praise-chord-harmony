
CREATE TABLE public.knowledge_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.knowledge_pages(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Sem título',
  icon text,
  content jsonb NOT NULL DEFAULT '[]'::jsonb,
  scope text NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal','local','estadual','nacional','global')),
  church_name text,
  estadual text,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_knowledge_pages_parent ON public.knowledge_pages(parent_id);
CREATE INDEX idx_knowledge_pages_owner ON public.knowledge_pages(owner_id);
CREATE INDEX idx_knowledge_pages_scope ON public.knowledge_pages(scope);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_pages TO authenticated;
GRANT ALL ON public.knowledge_pages TO service_role;

ALTER TABLE public.knowledge_pages ENABLE ROW LEVEL SECURITY;

-- SELECT
CREATE POLICY "knowledge_pages_select" ON public.knowledge_pages
FOR SELECT TO authenticated
USING (
  (scope = 'personal' AND owner_id = auth.uid())
  OR scope IN ('nacional','global')
  OR (scope = 'estadual' AND (
        public.has_role(auth.uid(),'admin'::public.app_role)
     OR public.has_role(auth.uid(),'lider_nacional'::public.app_role)
     OR estadual IS NOT DISTINCT FROM public.user_estadual(auth.uid())
  ))
  OR (scope = 'local' AND (
        public.has_role(auth.uid(),'admin'::public.app_role)
     OR public.has_role(auth.uid(),'lider_nacional'::public.app_role)
     OR (public.has_role(auth.uid(),'lider_estadual'::public.app_role)
          AND EXISTS (SELECT 1 FROM public.churches c WHERE c.name = knowledge_pages.church_name AND c.estadual IS NOT DISTINCT FROM public.user_estadual(auth.uid())))
     OR church_name IS NOT DISTINCT FROM public.user_church_name(auth.uid())
  ))
);

-- INSERT
CREATE POLICY "knowledge_pages_insert" ON public.knowledge_pages
FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid() AND (
    scope = 'personal'
    OR (scope = 'global' AND public.has_role(auth.uid(),'admin'::public.app_role))
    OR (scope = 'nacional' AND (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'lider_nacional'::public.app_role)))
    OR (scope = 'estadual' AND (
          public.has_role(auth.uid(),'admin'::public.app_role)
       OR public.has_role(auth.uid(),'lider_nacional'::public.app_role)
       OR (public.has_role(auth.uid(),'lider_estadual'::public.app_role) AND estadual IS NOT DISTINCT FROM public.user_estadual(auth.uid()))
    ))
    OR (scope = 'local' AND church_name IS NOT NULL AND public.can_manage_schedule_church(auth.uid(), church_name))
  )
);

-- UPDATE
CREATE POLICY "knowledge_pages_update" ON public.knowledge_pages
FOR UPDATE TO authenticated
USING (
  (scope = 'personal' AND owner_id = auth.uid())
  OR (scope = 'global' AND public.has_role(auth.uid(),'admin'::public.app_role))
  OR (scope = 'nacional' AND (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'lider_nacional'::public.app_role)))
  OR (scope = 'estadual' AND (
        public.has_role(auth.uid(),'admin'::public.app_role)
     OR public.has_role(auth.uid(),'lider_nacional'::public.app_role)
     OR (public.has_role(auth.uid(),'lider_estadual'::public.app_role) AND estadual IS NOT DISTINCT FROM public.user_estadual(auth.uid()))
  ))
  OR (scope = 'local' AND church_name IS NOT NULL AND public.can_manage_schedule_church(auth.uid(), church_name))
);

-- DELETE (same as update)
CREATE POLICY "knowledge_pages_delete" ON public.knowledge_pages
FOR DELETE TO authenticated
USING (
  (scope = 'personal' AND owner_id = auth.uid())
  OR (scope = 'global' AND public.has_role(auth.uid(),'admin'::public.app_role))
  OR (scope = 'nacional' AND (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'lider_nacional'::public.app_role)))
  OR (scope = 'estadual' AND (
        public.has_role(auth.uid(),'admin'::public.app_role)
     OR public.has_role(auth.uid(),'lider_nacional'::public.app_role)
     OR (public.has_role(auth.uid(),'lider_estadual'::public.app_role) AND estadual IS NOT DISTINCT FROM public.user_estadual(auth.uid()))
  ))
  OR (scope = 'local' AND church_name IS NOT NULL AND public.can_manage_schedule_church(auth.uid(), church_name))
);

CREATE TRIGGER update_knowledge_pages_updated_at
BEFORE UPDATE ON public.knowledge_pages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- favorites
CREATE TABLE public.knowledge_favorites (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id uuid NOT NULL REFERENCES public.knowledge_pages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, page_id)
);

GRANT SELECT, INSERT, DELETE ON public.knowledge_favorites TO authenticated;
GRANT ALL ON public.knowledge_favorites TO service_role;

ALTER TABLE public.knowledge_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_favorites_own" ON public.knowledge_favorites
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
