import Today from "./Today";

export default function AppDashboard() {
  return (
    <div className="app-dashboard-shell relative">
      <style>{`
        .app-dashboard-shell header {
          box-shadow: none !important;
        }
      `}</style>
      <Today />
    </div>
  );
}
