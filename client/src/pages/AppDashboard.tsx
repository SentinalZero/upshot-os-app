import Today from "./Today";
import { AppUserMenu } from "@/components/AppUserMenu";

export default function AppDashboard() {
  return (
    <div className="app-dashboard-shell relative">
      <style>{`
        .app-dashboard-shell header {
          box-shadow: none !important;
        }

        .app-dashboard-shell header > .container > a:last-child {
          margin-right: 15.5rem;
        }

        .app-dashboard-shell main {
          padding-top: 1.5rem !important;
        }

        @media (max-width: 639px) {
          .app-dashboard-shell header > .container > a:last-child {
            margin-right: 4.5rem;
            padding-left: 0.75rem;
            padding-right: 0.75rem;
          }

          .app-dashboard-shell main {
            padding-top: 1rem !important;
          }
        }
      `}</style>
      <Today />
      <div className="fixed right-4 top-2 z-[70] sm:right-6">
        <AppUserMenu />
      </div>
    </div>
  );
}
