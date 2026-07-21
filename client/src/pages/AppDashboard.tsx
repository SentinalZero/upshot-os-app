import InteractiveAppDashboard from "./InteractiveAppDashboard";
import { AppUserMenu } from "@/components/AppUserMenu";

export default function AppDashboard() {
  return (
    <div className="app-dashboard-shell relative">
      <style>{`
        .app-dashboard-shell header {
          box-shadow: none !important;
        }

        .app-dashboard-shell header > .container > div:last-child {
          visibility: hidden;
          pointer-events: none;
        }
      `}</style>
      <InteractiveAppDashboard />
      <div className="fixed right-4 top-2 z-[70] sm:right-6">
        <AppUserMenu />
      </div>
    </div>
  );
}
