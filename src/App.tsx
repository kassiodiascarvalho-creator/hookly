import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
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
import ProjectDetail from "./pages/ProjectDetail";
import CompanyProposals from "./pages/CompanyProposals";
import FindProjects from "./pages/FindProjects";
import ProjectView from "./pages/ProjectView";
import MyProposals from "./pages/MyProposals";
import Messages from "./pages/Messages";
import Settings from "./pages/Settings";
import TalentPool from "./pages/TalentPool";

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
            
            {/* Onboarding */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              }
            />
            
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
              <Route path="/proposals" element={<CompanyProposals />} />
              <Route path="/talent-pool" element={<TalentPool />} />
              <Route path="/finances" element={<Dashboard />} />
              <Route path="/settings" element={<Settings />} />
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
              <Route path="/earnings" element={<FreelancerDashboard />} />
              <Route path="/certifications" element={<FreelancerDashboard />} />
              <Route path="/settings" element={<Settings />} />
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
