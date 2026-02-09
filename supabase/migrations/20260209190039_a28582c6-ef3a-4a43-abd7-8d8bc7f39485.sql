
-- Create pinned_messages table
CREATE TABLE public.pinned_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  pinned_by UUID NOT NULL,
  pinned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, message_id)
);

-- Enable RLS
ALTER TABLE public.pinned_messages ENABLE ROW LEVEL SECURITY;

-- Members can view pinned messages in their conversations
CREATE POLICY "Members can view pinned messages"
ON public.pinned_messages
FOR SELECT
USING (is_conversation_member(conversation_id, auth.uid()));

-- Members can pin messages in their conversations
CREATE POLICY "Members can pin messages"
ON public.pinned_messages
FOR INSERT
WITH CHECK (auth.uid() = pinned_by AND is_conversation_member(conversation_id, auth.uid()));

-- Members can unpin messages in their conversations
CREATE POLICY "Members can unpin messages"
ON public.pinned_messages
FOR DELETE
USING (is_conversation_member(conversation_id, auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pinned_messages;
