import React, { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "next-themes";
import { DevTools } from "@/components/DevTools";
import { ScrollToTop } from "@/components/ScrollToTop";
import { createQueryClient, setupQueryLogging } from "@/lib/queryClientConfig";

// Eager load - these are accessed immediately
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy load - Rep pages
const RepDashboard = lazy(() => import("./pages/rep/RepDashboard"));
const RepCallHistory = lazy(() => import("./pages/rep/RepCallHistory"));
const RepProspects = lazy(() => import("./pages/rep/RepProspects"));
const ProspectDetail = lazy(() => import("./pages/rep/ProspectDetail"));
const RepCoachingSummary = lazy(() => import("./pages/rep/RepCoachingSummary"));

// Lazy load - Manager pages
const ManagerDashboard = lazy(() => import("./pages/manager/ManagerDashboard"));
const ManagerAccounts = lazy(() => import("./pages/manager/ManagerAccounts"));
const ManagerCoaching = lazy(() => import("./pages/manager/ManagerCoaching"));
const RepDetail = lazy(() => import("./pages/manager/RepDetail"));

// Lazy load - Admin pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminTeams = lazy(() => import("./pages/admin/AdminTeams"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminUserEdit = lazy(() => import("./pages/admin/AdminUserEdit"));
const AdminInviteUsers = lazy(() => import("./pages/admin/AdminInviteUsers"));
const AdminAccounts = lazy(() => import("./pages/admin/AdminAccounts"));
const AdminCoachingTrends = lazy(() => import("./pages/admin/AdminCoachingTrends"));
const AdminTranscriptAnalysis = lazy(() => import("./pages/admin/AdminTranscriptAnalysis"));
const AdminPerformanceMonitor = lazy(() => import("./pages/admin/AdminPerformanceMonitor"));

// Lazy load - Shared pages
const CallDetailPage = lazy(() => import("./pages/calls/CallDetailPage"));

// Lazy load - Marketing pages (public)
const ROICalculatorPage = lazy(() => import("./pages/marketing/ROICalculatorPage"));
const PitchDeckPage = lazy(() => import("./pages/marketing/PitchDeckPage"));
const DiscoveryQuestionsPage = lazy(() => import("./pages/marketing/DiscoveryQuestionsPage"));
const ExecutiveSummaryPage = lazy(() => import("./pages/marketing/ExecutiveSummaryPage"));

// Create query client with logging
const queryClient = createQueryClient();

// Setup logging in development
if (import.meta.env.DEV) {
  setupQueryLogging(queryClient);
}

// Loading fallback component
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <AuthProvider>
              <Suspense fallback={<PageLoader />}>
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
                  <ProtectedRoute allowedRoles={['rep', 'manager', 'admin']}>
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
                <Route path="/manager/accounts/:id" element={
                  <ProtectedRoute allowedRoles={['manager']}>
                    <ProspectDetail />
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
                <Route path="/manager/transcripts" element={
                  <ProtectedRoute allowedRoles={['manager']}>
                    <AdminTranscriptAnalysis />
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
                <Route path="/admin/users/:userId/edit" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminUserEdit />
                  </ProtectedRoute>
                } />
                <Route path="/admin/users/invite" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminInviteUsers />
                  </ProtectedRoute>
                } />
                <Route path="/admin/accounts" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminAccounts />
                  </ProtectedRoute>
                } />
                <Route path="/admin/accounts/:id" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ProspectDetail />
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
                <Route path="/admin/performance" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminPerformanceMonitor />
                  </ProtectedRoute>
                } />

                {/* Marketing Routes (Public) */}
                <Route path="/marketing/roi-calculator" element={<ROICalculatorPage />} />
                <Route path="/marketing/pitch-deck" element={<PitchDeckPage />} />
                <Route path="/marketing/discovery-questions" element={<DiscoveryQuestionsPage />} />
                <Route path="/marketing/executive-summary" element={<ExecutiveSummaryPage />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
      <DevTools />
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
