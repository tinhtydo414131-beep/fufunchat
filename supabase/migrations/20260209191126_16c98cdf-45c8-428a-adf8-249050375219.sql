
-- Create scheduled_messages table
CREATE TABLE public.scheduled_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  reply_to UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Users can view their own scheduled messages
CREATE POLICY "Users can view their own scheduled messages"
ON public.scheduled_messages
FOR SELECT
USING (auth.uid() = sender_id);

-- Users can create scheduled messages in conversations they belong to
CREATE POLICY "Users can create scheduled messages"
ON public.scheduled_messages
FOR INSERT
WITH CHECK (auth.uid() = sender_id AND is_conversation_member(conversation_id, auth.uid()));

-- Users can update their own scheduled messages (e.g. cancel)
CREATE POLICY "Users can update their own scheduled messages"
ON public.scheduled_messages
FOR UPDATE
USING (auth.uid() = sender_id);

-- Users can delete their own scheduled messages
CREATE POLICY "Users can delete their own scheduled messages"
ON public.scheduled_messages
FOR DELETE
USING (auth.uid() = sender_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_messages;

-- Enable pg_cron and pg_net extensions for scheduled processing
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
