
-- Create storage bucket for chat wallpapers
INSERT INTO storage.buckets (id, name, public)
VALUES ('wallpapers', 'wallpapers', true);

-- Allow authenticated users to upload their own wallpapers
CREATE POLICY "Users can upload wallpapers"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'wallpapers' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to update their own wallpapers
CREATE POLICY "Users can update their wallpapers"
ON storage.objects FOR UPDATE
USING (bucket_id = 'wallpapers' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to delete their own wallpapers
CREATE POLICY "Users can delete their wallpapers"
ON storage.objects FOR DELETE
USING (bucket_id = 'wallpapers' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Public read access for wallpapers
CREATE POLICY "Wallpapers are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'wallpapers');
