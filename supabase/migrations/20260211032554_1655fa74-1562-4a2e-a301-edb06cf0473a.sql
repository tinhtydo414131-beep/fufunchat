-- Update storage file size limit to 100MB for chat-media bucket
UPDATE storage.buckets SET file_size_limit = 104857600 WHERE id = 'chat-media';
UPDATE storage.buckets SET file_size_limit = 104857600 WHERE id = 'call-recordings';