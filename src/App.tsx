import React, { Suspense, lazy } from "react";
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
const RepTasks = lazy(() => import("./pages/rep/RepTasks"));

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
const AdminSalesCoachHistory = lazy(() => import("./pages/admin/AdminSalesCoachHistory"));
const AdminTranscriptAnalysis = lazy(() => import("./pages/admin/AdminTranscriptAnalysis"));
const AdminPerformanceMonitor = lazy(() => import("./pages/admin/AdminPerformanceMonitor"));
const AdminAuditLog = lazy(() => import("./pages/admin/AdminAuditLog"));
const AdminBulkUpload = lazy(() => import("./pages/admin/AdminBulkUpload"));
const AdminKnowledgeBase = lazy(() => import("./pages/admin/AdminKnowledgeBase"));
const AdminPlaybook = lazy(() => import("./pages/admin/AdminPlaybook"));
const AdminCompetitors = lazy(() => import("./pages/admin/AdminCompetitors"));
const AdminTrainingPersonas = lazy(() => import("./pages/admin/AdminTrainingPersonas"));
const AdminReporting = lazy(() => import("./pages/admin/AdminReporting"));
// Lazy load - Shared pages
const CallDetailPage = lazy(() => import("./pages/calls/CallDetailPage"));
const UserSettings = lazy(() => import("./pages/UserSettings"));

// Lazy load - Training pages
const TrainingDashboard = lazy(() => import("./pages/training/TrainingDashboard"));
const RoleplaySession = lazy(() => import("./pages/training/RoleplaySession"));
const TrainingHistory = lazy(() => import("./pages/training/TrainingHistory"));
const SessionDetail = lazy(() => import("./pages/training/SessionDetail"));
const TrainingProgress = lazy(() => import("./pages/training/TrainingProgress"));
const ManagerTrainingDashboard = lazy(() => import("./pages/training/ManagerTrainingDashboard"));

// Lazy load - SDR pages
const SDRDashboard = lazy(() => import("./pages/sdr/SDRDashboard"));
const SDRHistory = lazy(() => import("./pages/sdr/SDRHistory"));
const SDRTranscriptDetail = lazy(() => import("./pages/sdr/SDRTranscriptDetail"));
const SDRCallDetail = lazy(() => import("./pages/sdr/SDRCallDetail"));

// Lazy load - SDR Manager pages
const SDRManagerDashboard = lazy(() => import("./pages/sdr-manager/SDRManagerDashboard"));
const SDRManagerCoaching = lazy(() => import("./pages/sdr-manager/SDRManagerCoaching"));
const SDRManagerRepDetail = lazy(() => import("./pages/sdr-manager/SDRManagerRepDetail"));
const SDRManagerTranscripts = lazy(() => import("./pages/sdr-manager/SDRManagerTranscripts"));

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
                <Route path="/rep/tasks" element={
                  <ProtectedRoute allowedRoles={['rep']}>
                    <RepTasks />
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
                  <ProtectedRoute allowedRoles={['rep', 'manager', 'admin']}>
                    <UserSettings />
                  </ProtectedRoute>
                } />

                {/* Training Routes */}
                <Route path="/training" element={
                  <ProtectedRoute allowedRoles={['rep', 'admin']}>
                    <TrainingDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/training/roleplay/:personaId" element={
                  <ProtectedRoute allowedRoles={['rep', 'admin']}>
                    <RoleplaySession />
                  </ProtectedRoute>
                } />
                <Route path="/training/history" element={
                  <ProtectedRoute allowedRoles={['rep', 'manager', 'admin']}>
                    <TrainingHistory />
                  </ProtectedRoute>
                } />
                <Route path="/training/session/:sessionId" element={
                  <ProtectedRoute allowedRoles={['rep', 'manager', 'admin']}>
                    <SessionDetail />
                  </ProtectedRoute>
                } />
                <Route path="/training/progress" element={
                  <ProtectedRoute allowedRoles={['rep', 'admin']}>
                    <TrainingProgress />
                  </ProtectedRoute>
                } />
                {/* Manager Training Dashboard */}
                <Route path="/manager/training" element={
                  <ProtectedRoute allowedRoles={['manager', 'admin']}>
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
                <Route path="/admin/sales-coach" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminSalesCoachHistory />
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
                <Route path="/admin/knowledge-base" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminKnowledgeBase />
                  </ProtectedRoute>
                } />
                <Route path="/admin/training-personas" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminTrainingPersonas />
                  </ProtectedRoute>
                } />
                <Route path="/admin/reporting" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminReporting />
                  </ProtectedRoute>
                } />
                <Route path="/manager/reporting" element={
                  <ProtectedRoute allowedRoles={['manager']}>
                    <AdminReporting />
                  </ProtectedRoute>
                } />

                {/* SDR Routes */}
                <Route path="/sdr" element={
                  <ProtectedRoute allowedRoles={['sdr']}>
                    <SDRDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/sdr/history/:transcriptId" element={
                  <ProtectedRoute allowedRoles={['sdr', 'sdr_manager', 'admin']}>
                    <SDRTranscriptDetail />
                  </ProtectedRoute>
                } />
                <Route path="/sdr/calls/:callId" element={
                  <ProtectedRoute allowedRoles={['sdr', 'sdr_manager', 'admin']}>
                    <SDRCallDetail />
                  </ProtectedRoute>
                } />

                {/* SDR Manager Routes */}
                <Route path="/sdr-manager" element={
                  <ProtectedRoute allowedRoles={['sdr_manager']}>
                    <SDRManagerDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/sdr-manager/coaching" element={
                  <ProtectedRoute allowedRoles={['sdr_manager']}>
                    <SDRManagerCoaching />
                  </ProtectedRoute>
                } />
                <Route path="/sdr-manager/transcripts" element={
                  <ProtectedRoute allowedRoles={['sdr_manager']}>
                    <SDRTranscriptDetail />
                  </ProtectedRoute>
                } />
                <Route path="/sdr-manager/rep/:sdrId" element={
                  <ProtectedRoute allowedRoles={['sdr_manager', 'admin']}>
                    <SDRDashboard />
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