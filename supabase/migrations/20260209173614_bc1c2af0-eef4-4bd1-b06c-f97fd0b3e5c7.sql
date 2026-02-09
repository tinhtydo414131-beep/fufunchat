
-- Create tables first without cross-referencing policies

-- profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- conversations
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- conversation_members
CREATE TABLE public.conversation_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

-- messages
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'file')),
  reply_to UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- reactions
CREATE TABLE public.reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

-- Now add all RLS policies

-- profiles policies
CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- conversations policies
CREATE POLICY "Users can view conversations they belong to" ON public.conversations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = id AND user_id = auth.uid()));
CREATE POLICY "Authenticated users can create conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Members can update their conversations" ON public.conversations FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = id AND user_id = auth.uid()));

-- conversation_members policies
CREATE POLICY "Users can view members of their conversations" ON public.conversation_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversation_members AS cm WHERE cm.conversation_id = conversation_members.conversation_id AND cm.user_id = auth.uid()));
CREATE POLICY "Authenticated users can add members" ON public.conversation_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can remove themselves or admins can remove others" ON public.conversation_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.conversation_members AS cm WHERE cm.conversation_id = conversation_members.conversation_id AND cm.user_id = auth.uid() AND cm.role = 'admin'));

-- messages policies
CREATE POLICY "Users can view messages in their conversations" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()));
CREATE POLICY "Members can send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()));
CREATE POLICY "Senders can update their messages" ON public.messages FOR UPDATE TO authenticated USING (auth.uid() = sender_id);
CREATE POLICY "Senders can delete their messages" ON public.messages FOR DELETE TO authenticated USING (auth.uid() = sender_id);

-- reactions policies
CREATE POLICY "Users can view reactions in their conversations" ON public.reactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m JOIN public.conversation_members cm ON cm.conversation_id = m.conversation_id WHERE m.id = reactions.message_id AND cm.user_id = auth.uid()));
CREATE POLICY "Users can add reactions" ON public.reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their reactions" ON public.reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;

-- Storage
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-media', 'chat-media', true);
CREATE POLICY "Authenticated users can upload chat media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-media');
CREATE POLICY "Anyone can view chat media" ON storage.objects FOR SELECT USING (bucket_id = 'chat-media');
