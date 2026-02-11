ALTER TABLE public.messages DROP CONSTRAINT messages_type_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_type_check CHECK (type = ANY (ARRAY['text', 'image', 'file', 'video', 'voice']));