
-- Allow conversation creators to add other members
DROP POLICY "Users can add themselves or admins can add others" ON public.conversation_members;
CREATE POLICY "Users can add members to their conversations" ON public.conversation_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR
    public.is_conversation_member(conversation_id, auth.uid())
  );
