
-- The issue is all policies were created as RESTRICTIVE instead of PERMISSIVE
-- Need to recreate them as PERMISSIVE (default)

-- conversations
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view conversations they belong to" ON public.conversations;
DROP POLICY IF EXISTS "Members can update their conversations" ON public.conversations;

CREATE POLICY "Authenticated users can create conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can view conversations they belong to" ON public.conversations FOR SELECT TO authenticated USING (public.is_conversation_member(id, auth.uid()));
CREATE POLICY "Members can update their conversations" ON public.conversations FOR UPDATE TO authenticated USING (public.is_conversation_member(id, auth.uid()));

-- conversation_members
DROP POLICY IF EXISTS "Users can view members of their conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can add themselves or admins can add others" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can remove themselves or admins can remove others" ON public.conversation_members;

CREATE POLICY "Users can view members of their conversations" ON public.conversation_members FOR SELECT TO authenticated USING (public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "Users can add themselves or admins can add others" ON public.conversation_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can remove themselves or admins can remove others" ON public.conversation_members FOR DELETE TO authenticated USING (user_id = auth.uid());

-- messages
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Members can send messages" ON public.messages;
DROP POLICY IF EXISTS "Senders can update their messages" ON public.messages;
DROP POLICY IF EXISTS "Senders can delete their messages" ON public.messages;

CREATE POLICY "Users can view messages in their conversations" ON public.messages FOR SELECT TO authenticated USING (public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "Members can send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id AND public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "Senders can update their messages" ON public.messages FOR UPDATE TO authenticated USING (auth.uid() = sender_id);
CREATE POLICY "Senders can delete their messages" ON public.messages FOR DELETE TO authenticated USING (auth.uid() = sender_id);

-- profiles
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- reactions
DROP POLICY IF EXISTS "Users can view reactions in their conversations" ON public.reactions;
DROP POLICY IF EXISTS "Users can add reactions" ON public.reactions;
DROP POLICY IF EXISTS "Users can remove their reactions" ON public.reactions;

CREATE POLICY "Users can view reactions in their conversations" ON public.reactions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.messages m JOIN public.conversation_members cm ON cm.conversation_id = m.conversation_id WHERE m.id = reactions.message_id AND cm.user_id = auth.uid()));
CREATE POLICY "Users can add reactions" ON public.reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their reactions" ON public.reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);
