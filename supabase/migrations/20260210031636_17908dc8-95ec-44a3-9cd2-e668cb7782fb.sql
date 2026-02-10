
-- Add recording_url column to calls table
ALTER TABLE public.calls ADD COLUMN recording_url text DEFAULT null;

-- Create storage bucket for call recordings
INSERT INTO storage.buckets (id, name, public) VALUES ('call-recordings', 'call-recordings', true);

-- Storage policies for call recordings
CREATE POLICY "Authenticated users can upload recordings"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'call-recordings' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view recordings"
ON storage.objects FOR SELECT
USING (bucket_id = 'call-recordings');

CREATE POLICY "Users can delete their own recordings"
ON storage.objects FOR DELETE
USING (bucket_id = 'call-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
