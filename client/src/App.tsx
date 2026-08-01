import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppShell } from "./components/AppShell";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import OnboardingOrganization from "./pages/OnboardingOrganization";
import AppDashboard from "./pages/AppDashboard";
import Workforce from "./pages/Workforce";
import SpecialistDetail from "./pages/SpecialistDetail";
import DeployV2 from "./pages/DeployV2";
import Connections from "./pages/Connections";
import AccountSettings from "./pages/AccountSettings";

function AppRoute({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute requireOrg><AppShell>{children}</AppShell></ProtectedRoute>;
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/login"} component={Login} />
      <Route path={"/signup"} component={Signup} />
      <Route path={"/forgot-password"} component={ForgotPassword} />
      <Route path={"/onboarding/organization"}><ProtectedRoute><OnboardingOrganization /></ProtectedRoute></Route>
      <Route path={"/app/workforce/:specialistId"}><AppRoute><SpecialistDetail /></AppRoute></Route>
      <Route path={"/app/workforce"}><AppRoute><Workforce /></AppRoute></Route>
      <Route path={"/app"}><AppRoute><AppDashboard /></AppRoute></Route>
      <Route path={"/app/deploy"}><AppRoute><DeployV2 /></AppRoute></Route>
      <Route path={"/app/connections"}><AppRoute><Connections /></AppRoute></Route>
      <Route path={"/app/settings/profile"}><AppRoute><AccountSettings /></AppRoute></Route>
      <Route path={"/app/settings/team"}><AppRoute><AccountSettings /></AppRoute></Route>
      <Route path={"/app/settings/organization"}><AppRoute><AccountSettings /></AppRoute></Route>
      <Route path={"/app/settings/billing"}><AppRoute><AccountSettings /></AppRoute></Route>
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
