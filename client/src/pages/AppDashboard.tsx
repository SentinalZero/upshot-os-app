import InteractiveAppDashboard from "./InteractiveAppDashboard";
import { AppUserMenu } from "@/components/AppUserMenu";

export default function AppDashboard() {
  return (
    <div className="relative">
      <InteractiveAppDashboard />
      <div className="fixed right-4 top-2 z-[70] sm:right-6">
        <AppUserMenu />
      </div>
    </div>
  );
}
