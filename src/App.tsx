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
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import ProjectSelector from "./pages/ProjectSelector";
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
import PredictiveAnalysis from "./pages/PredictiveAnalysis";
import OptimizationHistory from "./pages/OptimizationHistory";
import Suggestions from "./pages/Suggestions";
import NotFound from "./pages/NotFound";

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
