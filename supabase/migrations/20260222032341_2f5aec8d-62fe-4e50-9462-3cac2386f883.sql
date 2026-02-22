
-- Update messages type check to allow new types: poll, location
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_type_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_type_check CHECK (type IN ('text', 'image', 'file', 'video', 'voice', 'poll', 'location'));

-- Create polls table
CREATE TABLE public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  creator_id uuid NOT NULL,
  question text NOT NULL,
  is_multiple_choice boolean DEFAULT false,
  is_anonymous boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create poll_options table
CREATE TABLE public.poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_text text NOT NULL,
  position integer DEFAULT 0
);

-- Create poll_votes table
CREATE TABLE public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(poll_id, option_id, user_id)
);

-- Enable RLS on all poll tables
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- RLS for polls: conversation members can view
CREATE POLICY "Members can view polls" ON public.polls
  FOR SELECT USING (public.is_conversation_member(conversation_id, auth.uid()));

-- RLS for polls: conversation members can create
CREATE POLICY "Members can create polls" ON public.polls
  FOR INSERT WITH CHECK (auth.uid() = creator_id AND public.is_conversation_member(conversation_id, auth.uid()));

-- RLS for poll_options: viewable if poll is viewable
CREATE POLICY "Members can view poll options" ON public.poll_options
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.polls p WHERE p.id = poll_options.poll_id AND public.is_conversation_member(p.conversation_id, auth.uid())
  ));

-- RLS for poll_options: creator can insert options
CREATE POLICY "Poll creators can add options" ON public.poll_options
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.polls p WHERE p.id = poll_options.poll_id AND p.creator_id = auth.uid()
  ));

-- RLS for poll_votes: viewable by conversation members
CREATE POLICY "Members can view votes" ON public.poll_votes
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.polls p WHERE p.id = poll_votes.poll_id AND public.is_conversation_member(p.conversation_id, auth.uid())
  ));

-- RLS for poll_votes: members can vote
CREATE POLICY "Members can vote" ON public.poll_votes
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM public.polls p WHERE p.id = poll_votes.poll_id AND public.is_conversation_member(p.conversation_id, auth.uid())
    )
  );

-- RLS for poll_votes: users can remove their own votes
CREATE POLICY "Users can remove their votes" ON public.poll_votes
  FOR DELETE USING (auth.uid() = user_id);

-- Enable realtime for poll_votes
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
