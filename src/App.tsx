import React, { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
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
import { ColorSchemeInitializer } from "@/lib/colorSchemeInit";
import { BrandedLoader } from "@/components/ui/branded-loader";

// Eager load - these are accessed immediately
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy load - Auth related pages
const ResetVerify = lazy(() => import("./pages/auth/ResetVerify"));

// Lazy load - Rep pages
const RepDashboard = lazy(() => import("./pages/rep/RepDashboard"));
const RepCallHistory = lazy(() => import("./pages/rep/RepCallHistory"));
const RepProspects = lazy(() => import("./pages/rep/RepProspects"));
const ProspectDetail = lazy(() => import("./pages/rep/ProspectDetail"));
const RepCoachingSummary = lazy(() => import("./pages/rep/RepCoachingSummary"));

// Lazy load - Manager pages
const ManagerDashboard = lazy(() => import("./pages/manager/ManagerDashboard"));
const ManagerCallHistory = lazy(() => import("./pages/manager/ManagerCallHistory"));
const ManagerAccounts = lazy(() => import("./pages/manager/ManagerAccounts"));
const ManagerCoaching = lazy(() => import("./pages/manager/ManagerCoaching"));
const RepDetail = lazy(() => import("./pages/manager/RepDetail"));

// Lazy load - Admin pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminCallHistory = lazy(() => import("./pages/admin/AdminCallHistory"));
const AdminTeams = lazy(() => import("./pages/admin/AdminTeams"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminUserEdit = lazy(() => import("./pages/admin/AdminUserEdit"));
const AdminInviteUsers = lazy(() => import("./pages/admin/AdminInviteUsers"));
const AdminAccounts = lazy(() => import("./pages/admin/AdminAccounts"));
const AdminCoachingTrends = lazy(() => import("./pages/admin/AdminCoachingTrends"));
const AdminTranscriptAnalysis = lazy(() => import("./pages/admin/AdminTranscriptAnalysis"));
const AdminPerformanceMonitor = lazy(() => import("./pages/admin/AdminPerformanceMonitor"));
const AdminAuditLog = lazy(() => import("./pages/admin/AdminAuditLog"));
const AdminBulkUpload = lazy(() => import("./pages/admin/AdminBulkUpload"));
const AdminPlaybook = lazy(() => import("./pages/admin/AdminPlaybook"));
const AdminCompetitors = lazy(() => import("./pages/admin/AdminCompetitors"));

// Lazy load - Shared pages
const CallDetailPage = lazy(() => import("./pages/calls/CallDetailPage"));
const UserSettings = lazy(() => import("./pages/UserSettings"));

// Lazy load - Training pages
const TrainingDashboard = lazy(() => import("./pages/training/TrainingDashboard"));
const RoleplaySession = lazy(() => import("./pages/training/RoleplaySession"));
const TrainingHistory = lazy(() => import("./pages/training/TrainingHistory"));
const ManagerTrainingDashboard = lazy(() => import("./pages/training/ManagerTrainingDashboard"));

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
  return <BrandedLoader variant="full-page" />;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <ColorSchemeInitializer />
        <TooltipProvider>
          <Toaster />
          <BrowserRouter>
            <ScrollToTop />
            <AuthProvider>
              <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/reset-verify" element={<ResetVerify />} />

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

                {/* User Settings Route (All Roles) */}
                <Route path="/settings" element={
                  <ProtectedRoute allowedRoles={['rep', 'manager', 'admin', 'trainee']}>
                    <UserSettings />
                  </ProtectedRoute>
                } />

                {/* Training Routes (Trainees and Reps can practice) */}
                <Route path="/training" element={
                  <ProtectedRoute allowedRoles={['trainee', 'rep']}>
                    <TrainingDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/training/roleplay/:personaId" element={
                  <ProtectedRoute allowedRoles={['trainee', 'rep']}>
                    <RoleplaySession />
                  </ProtectedRoute>
                } />
                <Route path="/training/history" element={
                  <ProtectedRoute allowedRoles={['trainee', 'rep', 'manager']}>
                    <TrainingHistory />
                  </ProtectedRoute>
                } />
                {/* Manager Training Dashboard */}
                <Route path="/manager/training" element={
                  <ProtectedRoute allowedRoles={['manager']}>
                    <ManagerTrainingDashboard />
                  </ProtectedRoute>
                } />

                {/* Manager Routes */}
                <Route path="/manager" element={
                  <ProtectedRoute allowedRoles={['manager']}>
                    <ManagerDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/manager/history" element={
                  <ProtectedRoute allowedRoles={['manager']}>
                    <ManagerCallHistory />
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
                <Route path="/manager/coaching-trends" element={
                  <ProtectedRoute allowedRoles={['manager']}>
                    <AdminCoachingTrends />
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
                <Route path="/manager/playbook" element={
                  <ProtectedRoute allowedRoles={['manager']}>
                    <AdminPlaybook />
                  </ProtectedRoute>
                } />

                {/* Admin Routes */}
                <Route path="/admin" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/admin/history" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminCallHistory />
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
                <Route path="/admin/audit-log" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminAuditLog />
                  </ProtectedRoute>
                } />
                <Route path="/admin/bulk-upload" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminBulkUpload />
                  </ProtectedRoute>
                } />
                <Route path="/admin/playbook" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminPlaybook />
                  </ProtectedRoute>
                } />
                <Route path="/admin/competitors" element={
                  <ProtectedRoute allowedRoles={['admin', 'manager', 'rep']}>
                    <AdminCompetitors />
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