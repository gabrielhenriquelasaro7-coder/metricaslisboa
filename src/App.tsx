import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { PeriodProvider } from "@/hooks/usePeriodContext";
import { AdminAuthProvider } from "@/hooks/useAdminAuth";
import { GuestAccessGuard } from "@/components/auth/GuestAccessGuard";
import { PWAProvider } from "@/components/pwa/PWAProvider";
import { AnimatePresence, motion } from "framer-motion";
import "@/i18n"; // Initialize i18n
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
// ProjectSelector removed - /projects redirects to /dashboard
import ProjectSetup from "./pages/ProjectSetup";
import ProjectDetail from "./pages/ProjectDetail";
import Dashboard from "./pages/Dashboard";
import Campaigns from "./pages/Campaigns";
import AdSets from "./pages/AdSets";
import AdSetDetail from "./pages/AdSetDetail";
import AdDetail from "./pages/AdDetail";
import Ads from "./pages/Ads";
import Creatives from "./pages/Creatives";
import CreativeDetail from "./pages/CreativeDetail";
import Settings from "./pages/Settings";
import SyncHistory from "./pages/SyncHistory";
import Admin from "./pages/Admin";
import ProjectAdmin from "./pages/ProjectAdmin";
import AIAssistant from "./pages/AIAssistant";
import WhatsApp from "./pages/WhatsApp";
import WhatsAppManager from "./pages/WhatsAppManager";
import ChangePassword from "./pages/ChangePassword";
import GuestOnboarding from "./pages/GuestOnboarding";
import GoogleCampaigns from "./pages/GoogleCampaigns";
import MetaAds from "./pages/MetaAds";
import Analytics from "./pages/Analytics";
import PredictiveAnalysis from "./pages/PredictiveAnalysis";
import OptimizationHistory from "./pages/OptimizationHistory";
import Suggestions from "./pages/Suggestions";
import Financial from "./pages/Financial";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ 
          duration: 0.1, 
          ease: [0.25, 0.1, 0.25, 1]
        }}
        style={{ willChange: 'opacity' }}
        className="w-full min-h-screen"
      >
        <Routes location={location}>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/projects" element={<Navigate to="/dashboard" replace />} />
          <Route path="/project-setup/:projectId" element={<ProjectSetup />} />
          <Route path="/project/:id" element={<ProjectDetail />} />
          <Route path="/project/:id/admin" element={<ProjectAdmin />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/meta-ads" element={<MetaAds />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/campaigns" element={<Navigate to="/meta-ads" replace />} />
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
          <Route path="/financeiro" element={<Financial />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
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
