
CREATE POLICY "Users can update their own membership"
ON public.conversation_members
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
