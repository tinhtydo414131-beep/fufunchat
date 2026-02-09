
-- Create user_statuses table
CREATE TABLE public.user_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'online',
  custom_text TEXT DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_statuses ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view statuses
CREATE POLICY "Authenticated users can view statuses"
ON public.user_statuses
FOR SELECT
USING (true);

-- Users can insert their own status
CREATE POLICY "Users can insert their own status"
ON public.user_statuses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own status
CREATE POLICY "Users can update their own status"
ON public.user_statuses
FOR UPDATE
USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_statuses;
