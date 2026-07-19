import { Switch, Route, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./hooks/use-auth";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import AdminDashboard from "@/pages/AdminDashboard";
import ClientDashboard from "@/pages/ClientDashboard";
import DesmancheDashboard from "@/pages/DesmancheDashboard";
import DesmancheOrderDetails from "@/pages/DesmancheOrderDetails";
import CadastroDesmanche from "@/pages/CadastroDesmanche";
import ComoFunciona from "@/pages/ComoFunciona";
import VerifyEmail from "@/pages/VerifyEmail";
import ResetPassword from "@/pages/ResetPassword";
import PoliticaPrivacidade from "@/pages/PoliticaPrivacidade";
import CadastroGuincho from "@/pages/CadastroGuincho";
import Guinchos from "@/pages/Guinchos";
import GuinhoDashboard from "@/pages/GuinhoDashboard";
import { PwaSuggestion } from "@/components/PwaExperience";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/cadastro-desmanche" component={CadastroDesmanche} />
      <Route path="/cadastro-guincho" component={CadastroGuincho} />
      <Route path="/guinchos" component={Guinchos} />
      <Route path="/guincho" component={GuinhoDashboard} />
      <Route path="/guincho/dashboard" component={GuinhoDashboard} />
      <Route path="/como-funciona" component={ComoFunciona} />
      <Route path="/cliente" component={ClientDashboard} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/desmanche" component={DesmancheDashboard} />
      <Route path="/desmanche/pedidos/:id" component={DesmancheOrderDetails} />
      <Route path="/verificar-email" component={VerifyEmail} />
      <Route path="/redefinir-senha" component={ResetPassword} />
      <Route path="/politica-de-privacidade" component={PoliticaPrivacidade} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <PwaSuggestion />
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
