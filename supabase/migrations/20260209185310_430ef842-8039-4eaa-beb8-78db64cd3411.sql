
-- Track when each user last read a conversation
CREATE TABLE public.message_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

-- Enable RLS
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

-- Members can view read receipts in their conversations
CREATE POLICY "Members can view read receipts"
ON public.message_reads
FOR SELECT
USING (public.is_conversation_member(conversation_id, auth.uid()));

-- Users can insert their own read receipt
CREATE POLICY "Users can insert their own read receipt"
ON public.message_reads
FOR INSERT
WITH CHECK (auth.uid() = user_id AND public.is_conversation_member(conversation_id, auth.uid()));

-- Users can update their own read receipt
CREATE POLICY "Users can update their own read receipt"
ON public.message_reads
FOR UPDATE
USING (auth.uid() = user_id);

-- Enable realtime for read receipts
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
