-- Fix: function add_platform_credits(...) is not unique
--
-- We currently have two overloads of add_platform_credits, and the newer one
-- defines DEFAULT parameters, which makes calls with 5 params ambiguous.
-- Dropping the legacy 5-arg overload removes ambiguity while keeping
-- backwards-compatibility (calls with 5 args will resolve to the 6-arg
-- function via DEFAULT p_credit_type = 'purchased').

DO $$
BEGIN
  DROP FUNCTION IF EXISTS public.add_platform_credits(uuid, text, integer, uuid, text);
END $$;
