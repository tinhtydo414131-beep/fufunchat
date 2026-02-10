-- Add pinned_at column to conversation_members for pinning conversations to top
ALTER TABLE public.conversation_members ADD COLUMN pinned_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;