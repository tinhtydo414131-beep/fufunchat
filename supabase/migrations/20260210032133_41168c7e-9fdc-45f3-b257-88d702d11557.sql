
-- Add disappear_after column to conversations (in seconds, null = no disappearing)
ALTER TABLE public.conversations ADD COLUMN disappear_after integer DEFAULT null;

-- Add expires_at column to messages
ALTER TABLE public.messages ADD COLUMN expires_at timestamp with time zone DEFAULT null;

-- Index for efficient cleanup queries
CREATE INDEX idx_messages_expires_at ON public.messages (expires_at) WHERE expires_at IS NOT NULL;
