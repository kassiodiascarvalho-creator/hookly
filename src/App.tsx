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
              <Route path="/projects" element={<Dashboard />} />
              <Route path="/projects/new" element={<Dashboard />} />
              <Route path="/proposals" element={<Dashboard />} />
              <Route path="/talent-pool" element={<Dashboard />} />
              <Route path="/finances" element={<Dashboard />} />
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
              <Route path="/find-projects" element={<FreelancerDashboard />} />
              <Route path="/my-proposals" element={<FreelancerDashboard />} />
              <Route path="/earnings" element={<FreelancerDashboard />} />
              <Route path="/certifications" element={<FreelancerDashboard />} />
            </Route>
            
            {/* Shared Routes (both user types) */}
            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/messages" element={<Dashboard />} />
              <Route path="/settings" element={<Dashboard />} />
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
