-- Add permission column for tracking pixels management
ALTER TABLE public.admin_permissions 
ADD COLUMN IF NOT EXISTS can_manage_tracking_pixels boolean DEFAULT false;

-- Update comment
COMMENT ON COLUMN public.admin_permissions.can_manage_tracking_pixels IS 'Permission to manage Facebook Pixel, Google Analytics, and GTM tracking codes';
