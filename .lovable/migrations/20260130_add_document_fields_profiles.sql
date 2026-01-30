-- Add document_type and document_number to freelancer_profiles
ALTER TABLE public.freelancer_profiles 
ADD COLUMN IF NOT EXISTS document_type text CHECK (document_type IN ('cpf', 'cnpj')),
ADD COLUMN IF NOT EXISTS document_number text;

-- Add document_type and document_number to company_profiles
ALTER TABLE public.company_profiles 
ADD COLUMN IF NOT EXISTS document_type text CHECK (document_type IN ('cpf', 'cnpj')),
ADD COLUMN IF NOT EXISTS document_number text;

-- Add comments for documentation
COMMENT ON COLUMN public.freelancer_profiles.document_type IS 'Type of tax document: cpf (individual) or cnpj (company)';
COMMENT ON COLUMN public.freelancer_profiles.document_number IS 'Tax document number (CPF: 11 digits, CNPJ: 14 digits)';
COMMENT ON COLUMN public.company_profiles.document_type IS 'Type of tax document: cpf (individual) or cnpj (company)';
COMMENT ON COLUMN public.company_profiles.document_number IS 'Tax document number (CPF: 11 digits, CNPJ: 14 digits)';