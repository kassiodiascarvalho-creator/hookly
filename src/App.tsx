import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import "@/lib/i18n";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import FreelancerDashboard from "./pages/FreelancerDashboard";
import Projects from "./pages/Projects";
import ProjectNew from "./pages/ProjectNew";
import ProjectEdit from "./pages/ProjectEdit";
import ProjectDetail from "./pages/ProjectDetail";
import CompanyProposals from "./pages/CompanyProposals";
import FindProjects from "./pages/FindProjects";
import ProjectView from "./pages/ProjectView";
import MyProposals from "./pages/MyProposals";
import Messages from "./pages/Messages";
import Settings from "./pages/Settings";
import TalentPool from "./pages/TalentPool";
import FreelancerProfile from "./pages/FreelancerProfile";
import Earnings from "./pages/Earnings";
import CompanyFinances from "./pages/CompanyFinances";
import FreelancerInvites from "./pages/FreelancerInvites";
import Contracts from "./pages/Contracts";
import ForCompanies from "./pages/ForCompanies";
import ForFreelancers from "./pages/ForFreelancers";
import Pricing from "./pages/Pricing";
import HowItWorks from "./pages/HowItWorks";
import AIHelp from "./pages/AIHelp";
// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminFreelancers from "./pages/admin/AdminFreelancers";
import AdminCompanies from "./pages/admin/AdminCompanies";
import AdminProjects from "./pages/admin/AdminProjects";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminPaymentProviders from "./pages/admin/AdminPaymentProviders";
import AdminLeads from "./pages/admin/AdminLeads";
import AdminFreelancerDetail from "./pages/admin/AdminFreelancerDetail";
import AdminCompanyDetail from "./pages/admin/AdminCompanyDetail";
import AdminFinances from "./pages/admin/AdminFinances";
import AdminTierManager from "./pages/admin/AdminTierManager";
import AdminLandingPage from "./pages/admin/AdminLandingPage";
import AdminManagement from "./pages/admin/AdminManagement";

// Public pages
import VerifiedCompanies from "./pages/VerifiedCompanies";
import CompanyProfile from "./pages/CompanyProfile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/empresas" element={<ForCompanies />} />
            <Route path="/freelancers" element={<ForFreelancers />} />
            <Route path="/precos" element={<Pricing />} />
            <Route path="/como-funciona" element={<HowItWorks />} />
            
            {/* Onboarding - sem ProtectedRoute para evitar loop */}
            <Route path="/onboarding" element={<Onboarding />} />
            
            {/* Admin Routes */}
            <Route
              element={
                <ProtectedRoute requireAdmin>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/freelancers" element={<AdminFreelancers />} />
              <Route path="/admin/freelancers/:userId" element={<AdminFreelancerDetail />} />
              <Route path="/admin/companies" element={<AdminCompanies />} />
              <Route path="/admin/companies/:userId" element={<AdminCompanyDetail />} />
              <Route path="/admin/projects" element={<AdminProjects />} />
              <Route path="/admin/payments" element={<AdminPayments />} />
              <Route path="/admin/payment-providers" element={<AdminPaymentProviders />} />
              <Route path="/admin/leads" element={<AdminLeads />} />
              <Route path="/admin/finances" element={<AdminFinances />} />
              <Route path="/admin/tiers" element={<AdminTierManager />} />
              <Route path="/admin/landing-page" element={<AdminLandingPage />} />
              <Route path="/admin/management" element={<AdminManagement />} />
            </Route>
            
            {/* Company Dashboard Routes */}
            <Route
              element={
                <ProtectedRoute allowedUserTypes={["company"]}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/new" element={<ProjectNew />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/projects/:id/edit" element={<ProjectEdit />} />
              <Route path="/proposals" element={<CompanyProposals />} />
              <Route path="/talent-pool" element={<TalentPool />} />
              <Route path="/freelancers/:userId" element={<FreelancerProfile />} />
              <Route path="/finances" element={<CompanyFinances />} />
            </Route>
            
            {/* Freelancer Dashboard Routes */}
            <Route
              element={
                <ProtectedRoute allowedUserTypes={["freelancer"]}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/freelancer-dashboard" element={<FreelancerDashboard />} />
              <Route path="/find-projects" element={<FindProjects />} />
              <Route path="/project/:id" element={<ProjectView />} />
              <Route path="/my-proposals" element={<MyProposals />} />
              <Route path="/earnings" element={<Earnings />} />
              <Route path="/invites" element={<FreelancerInvites />} />
              <Route path="/verified-companies" element={<VerifiedCompanies />} />
              <Route path="/certifications" element={<FreelancerDashboard />} />
              <Route path="/freelancers/:userId" element={<FreelancerProfile />} />
            </Route>
            
            {/* Shared Routes (both user types) */}
            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/messages" element={<Messages />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/contracts" element={<Contracts />} />
              <Route path="/companies/:userId" element={<CompanyProfile />} />
              <Route path="/help" element={<AIHelp />} />
            </Route>
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
