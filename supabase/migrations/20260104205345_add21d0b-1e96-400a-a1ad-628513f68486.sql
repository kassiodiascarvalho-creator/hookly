-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_type enum
CREATE TYPE public.user_type AS ENUM ('company', 'freelancer');

-- Create project_status enum
CREATE TYPE public.project_status AS ENUM ('draft', 'open', 'in_progress', 'completed');

-- Create proposal_status enum
CREATE TYPE public.proposal_status AS ENUM ('sent', 'accepted', 'rejected');

-- Create payment_status enum
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'released', 'failed');

-- Create payout_type enum
CREATE TYPE public.payout_type AS ENUM ('pix', 'bank');

-- Users/Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  role app_role DEFAULT 'user' NOT NULL,
  user_type user_type,
  preferred_language TEXT DEFAULT 'en' NOT NULL,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Company profiles
CREATE TABLE public.company_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  company_name TEXT,
  about TEXT,
  industry TEXT,
  company_size TEXT,
  website TEXT,
  location TEXT,
  logo_url TEXT,
  contact_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Freelancer profiles
CREATE TABLE public.freelancer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  title TEXT,
  bio TEXT,
  skills TEXT[] DEFAULT '{}',
  location TEXT,
  languages TEXT[] DEFAULT '{}',
  avatar_url TEXT,
  hourly_rate DECIMAL(10,2),
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Projects
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status project_status DEFAULT 'draft' NOT NULL,
  budget_min DECIMAL(10,2),
  budget_max DECIMAL(10,2),
  kpis JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Proposals
CREATE TABLE public.proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  freelancer_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cover_letter TEXT,
  milestones JSONB DEFAULT '[]',
  status proposal_status DEFAULT 'sent' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(project_id, freelancer_user_id)
);

-- Conversations
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  freelancer_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(company_user_id, freelancer_user_id)
);

-- Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  company_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  freelancer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD' NOT NULL,
  status payment_status DEFAULT 'pending' NOT NULL,
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Payout methods (freelancer)
CREATE TABLE public.payout_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freelancer_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type payout_type NOT NULL,
  pix_key TEXT,
  pix_key_type TEXT,
  bank_name TEXT,
  bank_code TEXT,
  branch TEXT,
  account TEXT,
  account_type TEXT,
  holder_name TEXT,
  holder_doc TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Payment method tokens (Stripe)
CREATE TABLE public.payment_method_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stripe_payment_method_id TEXT NOT NULL,
  brand TEXT,
  last4 TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Reviews
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  company_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  freelancer_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Newsletter leads
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Certifications (freelancer)
CREATE TABLE public.certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freelancer_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  issuer TEXT,
  issue_date DATE,
  expiry_date DATE,
  credential_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- User roles table (for admin check)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelancer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_method_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
$$;

-- Trigger function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, preferred_language)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'preferred_language', 'en')
  );
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_company_profiles_updated_at BEFORE UPDATE ON public.company_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_freelancer_profiles_updated_at BEFORE UPDATE ON public.freelancer_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_proposals_updated_at BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payout_methods_updated_at BEFORE UPDATE ON public.payout_methods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_certifications_updated_at BEFORE UPDATE ON public.certifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- Profiles: Users can read all profiles, update their own
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE USING (public.is_admin());

-- Company profiles: Viewable by all, editable by owner
CREATE POLICY "Company profiles are viewable by everyone" ON public.company_profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own company profile" ON public.company_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own company profile" ON public.company_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own company profile" ON public.company_profiles FOR DELETE USING (auth.uid() = user_id);

-- Freelancer profiles: Viewable by all, editable by owner
CREATE POLICY "Freelancer profiles are viewable by everyone" ON public.freelancer_profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own freelancer profile" ON public.freelancer_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own freelancer profile" ON public.freelancer_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own freelancer profile" ON public.freelancer_profiles FOR DELETE USING (auth.uid() = user_id);

-- Projects: Open projects viewable by all, own projects fully accessible
CREATE POLICY "Open projects are viewable by everyone" ON public.projects FOR SELECT USING (status = 'open' OR company_user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Companies can insert own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = company_user_id);
CREATE POLICY "Companies can update own projects" ON public.projects FOR UPDATE USING (auth.uid() = company_user_id OR public.is_admin());
CREATE POLICY "Companies can delete own projects" ON public.projects FOR DELETE USING (auth.uid() = company_user_id OR public.is_admin());

-- Proposals: Freelancers see own, companies see proposals for their projects
CREATE POLICY "Freelancers can view own proposals" ON public.proposals FOR SELECT USING (freelancer_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.projects WHERE projects.id = proposals.project_id AND projects.company_user_id = auth.uid()) OR public.is_admin());
CREATE POLICY "Freelancers can insert proposals" ON public.proposals FOR INSERT WITH CHECK (auth.uid() = freelancer_user_id);
CREATE POLICY "Freelancers can update own proposals" ON public.proposals FOR UPDATE USING (freelancer_user_id = auth.uid());
CREATE POLICY "Companies can update proposals on their projects" ON public.proposals FOR UPDATE USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = proposals.project_id AND projects.company_user_id = auth.uid()));
CREATE POLICY "Freelancers can delete own proposals" ON public.proposals FOR DELETE USING (freelancer_user_id = auth.uid());

-- Conversations: Participants only
CREATE POLICY "Users can view own conversations" ON public.conversations FOR SELECT USING (company_user_id = auth.uid() OR freelancer_user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Users can insert conversations they're part of" ON public.conversations FOR INSERT WITH CHECK (company_user_id = auth.uid() OR freelancer_user_id = auth.uid());
CREATE POLICY "Users can update own conversations" ON public.conversations FOR UPDATE USING (company_user_id = auth.uid() OR freelancer_user_id = auth.uid());

-- Messages: Conversation participants only
CREATE POLICY "Users can view messages in their conversations" ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.conversations WHERE conversations.id = messages.conversation_id AND (conversations.company_user_id = auth.uid() OR conversations.freelancer_user_id = auth.uid()))
  OR public.is_admin()
);
CREATE POLICY "Users can insert messages in their conversations" ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = sender_user_id AND
  EXISTS (SELECT 1 FROM public.conversations WHERE conversations.id = messages.conversation_id AND (conversations.company_user_id = auth.uid() OR conversations.freelancer_user_id = auth.uid()))
);
CREATE POLICY "Users can update messages in their conversations" ON public.messages FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.conversations WHERE conversations.id = messages.conversation_id AND (conversations.company_user_id = auth.uid() OR conversations.freelancer_user_id = auth.uid()))
);

-- Payments: Participants only
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (company_user_id = auth.uid() OR freelancer_user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Companies can insert payments" ON public.payments FOR INSERT WITH CHECK (auth.uid() = company_user_id);
CREATE POLICY "Payments can be updated by participants or admin" ON public.payments FOR UPDATE USING (company_user_id = auth.uid() OR freelancer_user_id = auth.uid() OR public.is_admin());

-- Payout methods: Owner only
CREATE POLICY "Freelancers can view own payout methods" ON public.payout_methods FOR SELECT USING (freelancer_user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Freelancers can insert own payout methods" ON public.payout_methods FOR INSERT WITH CHECK (auth.uid() = freelancer_user_id);
CREATE POLICY "Freelancers can update own payout methods" ON public.payout_methods FOR UPDATE USING (freelancer_user_id = auth.uid());
CREATE POLICY "Freelancers can delete own payout methods" ON public.payout_methods FOR DELETE USING (freelancer_user_id = auth.uid());

-- Payment method tokens: Owner only
CREATE POLICY "Users can view own payment method tokens" ON public.payment_method_tokens FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Users can insert own payment method tokens" ON public.payment_method_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own payment method tokens" ON public.payment_method_tokens FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own payment method tokens" ON public.payment_method_tokens FOR DELETE USING (user_id = auth.uid());

-- Reviews: Public read, participants write
CREATE POLICY "Reviews are viewable by everyone" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Companies can insert reviews for their projects" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = company_user_id);

-- Leads: Public insert (newsletter signup), admin read
CREATE POLICY "Anyone can subscribe to newsletter" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view leads" ON public.leads FOR SELECT USING (public.is_admin());

-- Notifications: Owner only
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- Certifications: Owner can manage, public can view
CREATE POLICY "Certifications are viewable by everyone" ON public.certifications FOR SELECT USING (true);
CREATE POLICY "Freelancers can insert own certifications" ON public.certifications FOR INSERT WITH CHECK (auth.uid() = freelancer_user_id);
CREATE POLICY "Freelancers can update own certifications" ON public.certifications FOR UPDATE USING (freelancer_user_id = auth.uid());
CREATE POLICY "Freelancers can delete own certifications" ON public.certifications FOR DELETE USING (freelancer_user_id = auth.uid());

-- User roles: Admin only management
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE USING (public.is_admin());

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create indexes for performance
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_projects_company_user_id ON public.projects(company_user_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_proposals_project_id ON public.proposals(project_id);
CREATE INDEX idx_proposals_freelancer_user_id ON public.proposals(freelancer_user_id);
CREATE INDEX idx_conversations_company_user_id ON public.conversations(company_user_id);
CREATE INDEX idx_conversations_freelancer_user_id ON public.conversations(freelancer_user_id);
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read_at ON public.notifications(read_at);