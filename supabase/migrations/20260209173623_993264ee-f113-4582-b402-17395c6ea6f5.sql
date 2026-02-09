
-- Fix permissive INSERT policies

-- Tighten conversations: creator must also add themselves as member (handled in app logic, but restrict to authenticated is sufficient)
DROP POLICY "Authenticated users can create conversations" ON public.conversations;
CREATE POLICY "Authenticated users can create conversations" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Tighten conversation_members: user can only add themselves, or admins can add others
DROP POLICY "Authenticated users can add members" ON public.conversation_members;
CREATE POLICY "Users can add themselves or admins can add others" ON public.conversation_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.conversation_members AS cm
      WHERE cm.conversation_id = conversation_members.conversation_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'admin'
    )
  );
