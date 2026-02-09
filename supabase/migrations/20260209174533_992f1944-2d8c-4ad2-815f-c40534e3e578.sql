
-- Fix conversation_members SELECT policy (self-referencing causes infinite recursion)
-- Use a security definer function instead
CREATE OR REPLACE FUNCTION public.is_conversation_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  )
$$;

-- Fix conversation_members SELECT policy
DROP POLICY "Users can view members of their conversations" ON public.conversation_members;
CREATE POLICY "Users can view members of their conversations" ON public.conversation_members FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));

-- Fix conversations SELECT policy (was comparing wrong columns)
DROP POLICY "Users can view conversations they belong to" ON public.conversations;
CREATE POLICY "Users can view conversations they belong to" ON public.conversations FOR SELECT TO authenticated
  USING (public.is_conversation_member(id, auth.uid()));

-- Fix conversations UPDATE policy 
DROP POLICY "Members can update their conversations" ON public.conversations;
CREATE POLICY "Members can update their conversations" ON public.conversations FOR UPDATE TO authenticated
  USING (public.is_conversation_member(id, auth.uid()));

-- Fix messages SELECT policy to use the function too
DROP POLICY "Users can view messages in their conversations" ON public.messages;
CREATE POLICY "Users can view messages in their conversations" ON public.messages FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));

-- Fix messages INSERT policy
DROP POLICY "Members can send messages" ON public.messages;
CREATE POLICY "Members can send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND public.is_conversation_member(conversation_id, auth.uid()));

-- Fix conversation_members INSERT policy to avoid recursion
DROP POLICY "Users can add themselves or admins can add others" ON public.conversation_members;
CREATE POLICY "Users can add themselves or admins can add others" ON public.conversation_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.is_conversation_member(conversation_id, auth.uid()) AS x WHERE x = true
    )
  );

-- Fix conversation_members DELETE policy
DROP POLICY "Users can remove themselves or admins can remove others" ON public.conversation_members;
CREATE POLICY "Users can remove themselves or admins can remove others" ON public.conversation_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_conversation_member(conversation_id, auth.uid()));
