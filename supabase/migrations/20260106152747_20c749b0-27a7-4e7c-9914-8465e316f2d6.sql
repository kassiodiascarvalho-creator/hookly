-- Make chat_uploads bucket private for security
UPDATE storage.buckets 
SET public = false 
WHERE id = 'chat_uploads';