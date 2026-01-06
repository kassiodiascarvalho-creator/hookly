-- Make chat_uploads bucket public to fix 404 issues on files
UPDATE storage.buckets 
SET public = true 
WHERE id = 'chat_uploads';