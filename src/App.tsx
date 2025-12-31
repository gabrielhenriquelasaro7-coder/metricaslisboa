import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { PeriodProvider } from "@/hooks/usePeriodContext";
import { AdminAuthProvider } from "@/hooks/useAdminAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import ProjectSelector from "./pages/ProjectSelector";
import ProjectSetup from "./pages/ProjectSetup";
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
import AIAssistant from "./pages/AIAssistant";
import WhatsApp from "./pages/WhatsApp";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AdminAuthProvider>
        <PeriodProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/projects" element={<ProjectSelector />} />
                <Route path="/project-setup/:projectId" element={<ProjectSetup />} />
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
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </PeriodProvider>
      </AdminAuthProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
