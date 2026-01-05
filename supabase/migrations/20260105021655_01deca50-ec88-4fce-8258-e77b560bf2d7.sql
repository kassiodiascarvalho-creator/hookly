-- Add new columns to payments table for better financial tracking
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS escrow_status TEXT DEFAULT 'held' CHECK (escrow_status IN ('held', 'released', 'refunded')),
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS released_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS released_by_admin_id UUID;

-- Create payment_logs table for audit trail
CREATE TABLE IF NOT EXISTS public.payment_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  admin_user_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on payment_logs
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view and insert payment logs
CREATE POLICY "Admins can view payment logs"
ON public.payment_logs
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can insert payment logs"
ON public.payment_logs
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- System can insert payment logs (for webhook)
CREATE POLICY "System can insert payment logs"
ON public.payment_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Update payments table - admins can update all payments
CREATE POLICY "Admins can update all payments"
ON public.payments
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_escrow_status ON public.payments(escrow_status);
CREATE INDEX IF NOT EXISTS idx_payment_logs_payment_id ON public.payment_logs(payment_id);