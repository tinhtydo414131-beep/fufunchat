
-- Table to store user public keys for E2EE
CREATE TABLE public.user_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_keys ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read public keys (needed for encryption)
CREATE POLICY "Anyone can read public keys"
ON public.user_keys FOR SELECT
TO authenticated
USING (true);

-- Users can insert their own key
CREATE POLICY "Users can insert own key"
ON public.user_keys FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own key
CREATE POLICY "Users can update own key"
ON public.user_keys FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_keys_updated_at
BEFORE UPDATE ON public.user_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for user_keys
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_keys;
