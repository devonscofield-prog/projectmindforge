import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Rep pages
import RepDashboard from "./pages/rep/RepDashboard";
import RepCallHistory from "./pages/rep/RepCallHistory";
import RepProspects from "./pages/rep/RepProspects";
import ProspectDetail from "./pages/rep/ProspectDetail";
import RepCoachingSummary from "./pages/rep/RepCoachingSummary";

// Manager pages
import ManagerDashboard from "./pages/manager/ManagerDashboard";
import ManagerAccounts from "./pages/manager/ManagerAccounts";
import ManagerCoaching from "./pages/manager/ManagerCoaching";
import RepDetail from "./pages/manager/RepDetail";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminTeams from "./pages/admin/AdminTeams";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminAccounts from "./pages/admin/AdminAccounts";
import AdminCoachingTrends from "./pages/admin/AdminCoachingTrends";
import AdminTranscriptAnalysis from "./pages/admin/AdminTranscriptAnalysis";

// Shared pages
import CallDetailPage from "./pages/calls/CallDetailPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
            {/* Rep Routes */}
            <Route path="/rep" element={
              <ProtectedRoute allowedRoles={['rep']}>
                <RepDashboard />
              </ProtectedRoute>
            } />
            <Route path="/rep/history" element={
              <ProtectedRoute allowedRoles={['rep']}>
                <RepCallHistory />
              </ProtectedRoute>
            } />
            <Route path="/rep/prospects" element={
              <ProtectedRoute allowedRoles={['rep']}>
                <RepProspects />
              </ProtectedRoute>
            } />
            <Route path="/rep/prospects/:id" element={
              <ProtectedRoute allowedRoles={['rep', 'manager']}>
                <ProspectDetail />
              </ProtectedRoute>
            } />
            <Route path="/rep/coaching-summary" element={
              <ProtectedRoute allowedRoles={['rep']}>
                <RepCoachingSummary />
              </ProtectedRoute>
            } />
            <Route path="/rep/coaching-summary/:repId" element={
              <ProtectedRoute allowedRoles={['manager', 'admin']}>
                <RepCoachingSummary />
              </ProtectedRoute>
            } />

            {/* Shared Call Detail Route */}
            <Route path="/calls/:id" element={
              <ProtectedRoute allowedRoles={['rep', 'manager', 'admin']}>
                <CallDetailPage />
              </ProtectedRoute>
            } />

            {/* Manager Routes */}
            <Route path="/manager" element={
              <ProtectedRoute allowedRoles={['manager']}>
                <ManagerDashboard />
              </ProtectedRoute>
            } />
            <Route path="/manager/accounts" element={
              <ProtectedRoute allowedRoles={['manager']}>
                <ManagerAccounts />
              </ProtectedRoute>
            } />
            <Route path="/manager/prospects/:id" element={
              <ProtectedRoute allowedRoles={['manager']}>
                <ProspectDetail />
              </ProtectedRoute>
            } />
            <Route path="/manager/coaching" element={
              <ProtectedRoute allowedRoles={['manager']}>
                <ManagerCoaching />
              </ProtectedRoute>
            } />
            <Route path="/manager/rep/:repId" element={
              <ProtectedRoute allowedRoles={['manager', 'admin']}>
                <RepDetail />
              </ProtectedRoute>
            } />

            {/* Admin Routes */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/teams" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminTeams />
              </ProtectedRoute>
            } />
            <Route path="/admin/users" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminUsers />
              </ProtectedRoute>
            } />
            <Route path="/admin/accounts" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminAccounts />
              </ProtectedRoute>
            } />
            <Route path="/admin/coaching" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminCoachingTrends />
              </ProtectedRoute>
            } />
            <Route path="/admin/transcripts" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminTranscriptAnalysis />
              </ProtectedRoute>
            } />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
