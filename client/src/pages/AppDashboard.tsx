import Today from "./Today";
import { AppUserMenu } from "@/components/AppUserMenu";

export default function AppDashboard() {
  return (
    <div className="app-dashboard-shell relative">
      <style>{`
        .app-dashboard-shell header {
          box-shadow: none !important;
        }
      `}</style>
      <Today />
      <div className="fixed right-4 top-2 z-[70] sm:right-6">
        <AppUserMenu />
      </div>
    </div>
  );
}
