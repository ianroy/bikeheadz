import { Outlet } from "react-router";
import { Header } from "./components/Header";

export function Root() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#09090f", color: "#e0e0f0" }}>
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
