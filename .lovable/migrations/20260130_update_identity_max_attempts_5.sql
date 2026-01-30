-- Update default max_attempts from 2 to 5
ALTER TABLE identity_verifications 
ALTER COLUMN max_attempts SET DEFAULT 5;

-- Update existing records that still have 2 attempts to 5
UPDATE identity_verifications 
SET max_attempts = 5 
WHERE max_attempts = 2;