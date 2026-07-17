import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import OnboardingOrganization from "@/pages/OnboardingOrganization";
import AppDashboard from "@/pages/AppDashboard";
import Deploy from "@/pages/Deploy";
import Connections from "@/pages/Connections";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/login"} component={Login} />
      <Route path={"/signup"} component={Signup} />
      <Route path={"/forgot-password"} component={ForgotPassword} />
      <Route path={"/onboarding/organization"}>
        <ProtectedRoute>
          <OnboardingOrganization />
        </ProtectedRoute>
      </Route>
      <Route path={"/app"}>
        <ProtectedRoute requireOrg>
          <AppDashboard />
        </ProtectedRoute>
      </Route>
      <Route path={"/app/deploy"}>
        <ProtectedRoute requireOrg>
          <Deploy />
        </ProtectedRoute>
      </Route>
      <Route path={"/app/connections"}>
        <ProtectedRoute requireOrg>
          <Connections />
        </ProtectedRoute>
      </Route>
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
