
-- Create calls table for tracking voice/video call state
CREATE TABLE public.calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  caller_id UUID NOT NULL,
  call_type TEXT NOT NULL DEFAULT 'voice' CHECK (call_type IN ('voice', 'video')),
  status TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'active', 'ended', 'missed', 'declined')),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- Only conversation members can view calls
CREATE POLICY "Members can view calls"
ON public.calls FOR SELECT
USING (public.is_conversation_member(conversation_id, auth.uid()));

-- Only conversation members can create calls
CREATE POLICY "Members can create calls"
ON public.calls FOR INSERT
WITH CHECK (public.is_conversation_member(conversation_id, auth.uid()) AND auth.uid() = caller_id);

-- Only conversation members can update calls (answer, decline, end)
CREATE POLICY "Members can update calls"
ON public.calls FOR UPDATE
USING (public.is_conversation_member(conversation_id, auth.uid()));

-- Enable realtime for calls
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
