import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import OnboardingOrganization from "./pages/OnboardingOrganization";
import AppDashboard from "./pages/AppDashboard";
import Workforce from "./pages/Workforce";
import DeployV2 from "./pages/DeployV2";
import Connections from "./pages/Connections";
import AccountSettings from "./pages/AccountSettings";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/login"} component={Login} />
      <Route path={"/signup"} component={Signup} />
      <Route path={"/forgot-password"} component={ForgotPassword} />
      <Route path={"/onboarding/organization"}><ProtectedRoute><OnboardingOrganization /></ProtectedRoute></Route>
      <Route path={"/app/workforce"}><ProtectedRoute requireOrg><Workforce /></ProtectedRoute></Route>
      <Route path={"/app"}><ProtectedRoute requireOrg><AppDashboard /></ProtectedRoute></Route>
      <Route path={"/app/deploy"}><ProtectedRoute requireOrg><DeployV2 /></ProtectedRoute></Route>
      <Route path={"/app/connections"}><ProtectedRoute requireOrg><Connections /></ProtectedRoute></Route>
      <Route path={"/app/settings/profile"}><ProtectedRoute requireOrg><AccountSettings /></ProtectedRoute></Route>
      <Route path={"/app/settings/team"}><ProtectedRoute requireOrg><AccountSettings /></ProtectedRoute></Route>
      <Route path={"/app/settings/organization"}><ProtectedRoute requireOrg><AccountSettings /></ProtectedRoute></Route>
      <Route path={"/app/settings/billing"}><ProtectedRoute requireOrg><AccountSettings /></ProtectedRoute></Route>
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
