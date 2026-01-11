import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { PeriodProvider } from "@/hooks/usePeriodContext";
import { AdminAuthProvider } from "@/hooks/useAdminAuth";
import { GuestAccessGuard } from "@/components/auth/GuestAccessGuard";
import { PWAProvider } from "@/components/pwa/PWAProvider";
import { AnimatePresence, motion } from "framer-motion";
import { Suspense, lazy } from "react";
import { LoadingScreen } from "@/components/ui/loading-screen";

// Lazy load all pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const ProjectSelector = lazy(() => import("./pages/ProjectSelector"));
const ProjectSetup = lazy(() => import("./pages/ProjectSetup"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const AdSets = lazy(() => import("./pages/AdSets"));
const AdSetDetail = lazy(() => import("./pages/AdSetDetail"));
const AdDetail = lazy(() => import("./pages/AdDetail"));
const Ads = lazy(() => import("./pages/Ads"));
const Creatives = lazy(() => import("./pages/Creatives"));
const CreativeDetail = lazy(() => import("./pages/CreativeDetail"));
const Settings = lazy(() => import("./pages/Settings"));
const SyncHistory = lazy(() => import("./pages/SyncHistory"));
const Admin = lazy(() => import("./pages/Admin"));
const ProjectAdmin = lazy(() => import("./pages/ProjectAdmin"));
const AIAssistant = lazy(() => import("./pages/AIAssistant"));
const WhatsApp = lazy(() => import("./pages/WhatsApp"));
const WhatsAppManager = lazy(() => import("./pages/WhatsAppManager"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const GuestOnboarding = lazy(() => import("./pages/GuestOnboarding"));
const GoogleCampaigns = lazy(() => import("./pages/GoogleCampaigns"));
const PredictiveAnalysis = lazy(() => import("./pages/PredictiveAnalysis"));
const OptimizationHistory = lazy(() => import("./pages/OptimizationHistory"));
const Suggestions = lazy(() => import("./pages/Suggestions"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full min-h-screen"
      >
        <Suspense fallback={<LoadingScreen />}>
          <Routes location={location}>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/projects" element={<ProjectSelector />} />
            <Route path="/project-setup/:projectId" element={<ProjectSetup />} />
            <Route path="/project/:id" element={<ProjectDetail />} />
            <Route path="/project/:id/admin" element={<ProjectAdmin />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/campaign/:campaignId/adsets" element={<AdSets />} />
            <Route path="/adset/:adSetId" element={<AdSetDetail />} />
            <Route path="/ad/:adId" element={<AdDetail />} />
            <Route path="/adset/:adSetId/ads" element={<Ads />} />
            <Route path="/creatives" element={<Creatives />} />
            <Route path="/creative/:id" element={<CreativeDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/sync-history" element={<SyncHistory />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/ai-assistant" element={<AIAssistant />} />
            <Route path="/whatsapp" element={<WhatsApp />} />
            <Route path="/whatsapp-manager" element={<WhatsAppManager />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/guest-onboarding" element={<GuestOnboarding />} />
            <Route path="/google-campaigns" element={<GoogleCampaigns />} />
            <Route path="/predictive-analysis" element={<PredictiveAnalysis />} />
            <Route path="/optimization-history" element={<OptimizationHistory />} />
            <Route path="/suggestions" element={<Suggestions />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AdminAuthProvider>
        <PeriodProvider>
          <TooltipProvider>
            <PWAProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <GuestAccessGuard>
                  <AnimatedRoutes />
                </GuestAccessGuard>
              </BrowserRouter>
            </PWAProvider>
          </TooltipProvider>
        </PeriodProvider>
      </AdminAuthProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
