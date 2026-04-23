import { useState } from "react";
import {
  User,
  Mail,
  Package,
  Download,
  Star,
  Settings,
  LogOut,
  Camera,
  ChevronRight,
  Bike,
} from "lucide-react";

const ORDERS = [
  {
    id: "ORD-2841",
    name: "Alex's Chrome Head",
    date: "Apr 18, 2026",
    status: "Shipped",
    price: "$19.99",
    qty: 1,
  },
  {
    id: "ORD-2759",
    name: "Jordan 4-Pack",
    date: "Apr 5, 2026",
    status: "Delivered",
    price: "$59.99",
    qty: 4,
  },
  {
    id: "ORD-2601",
    name: "Sam Matte Print",
    date: "Mar 18, 2026",
    status: "Delivered",
    price: "$19.99",
    qty: 1,
  },
];

const STATUS_COLORS: Record<string, string> = {
  Shipped: "#4d9fff",
  Delivered: "#b4ff45",
  Processing: "#ff6b30",
};

export function AccountPage() {
  const [activeTab, setActiveTab] = useState<"designs" | "orders" | "settings">("designs");
  const [displayName, setDisplayName] = useState("Alex Rider");
  const [email, setEmail] = useState("alex@bikeheadz.com");

  const tabs = [
    { id: "designs" as const, label: "My Designs", icon: Bike },
    { id: "orders" as const, label: "Orders", icon: Package },
    { id: "settings" as const, label: "Settings", icon: Settings },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Profile header */}
      <div
        className="rounded-2xl p-6 border border-[#1e1e35] mb-6 flex items-center gap-5"
        style={{ background: "#111120" }}
      >
        <div className="relative">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl"
            style={{ background: "linear-gradient(135deg, #1a2a08, #2a4010)" }}
          >
            🚴
          </div>
          <button
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg flex items-center justify-center border border-[#1e1e35]"
            style={{ background: "#1a1a2e" }}
          >
            <Camera className="w-3.5 h-3.5 text-[#b4ff45]" />
          </button>
        </div>
        <div className="flex-1">
          <h1 className="text-white" style={{ fontWeight: 800, fontSize: "1.3rem" }}>
            {displayName}
          </h1>
          <p className="text-[#808098]" style={{ fontSize: "0.85rem" }}>
            {email}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span
              className="px-2 py-0.5 rounded-full"
              style={{ background: "rgba(180,255,69,0.12)", color: "#b4ff45", fontSize: "0.72rem", fontWeight: 700 }}
            >
              ✓ Verified Rider
            </span>
            <span className="text-[#606080]" style={{ fontSize: "0.75rem" }}>
              3 designs · 2 orders
            </span>
          </div>
        </div>
        <button className="flex items-center gap-1.5 text-[#606080] hover:text-[#ff6b30] transition-colors" style={{ fontSize: "0.8rem" }}>
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>

      {/* Tabs */}
      <div
        className="flex rounded-xl p-1 mb-5 gap-1"
        style={{ background: "#111120", border: "1px solid #1e1e35" }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg transition-all ${
              activeTab === tab.id
                ? "text-black"
                : "text-[#808098] hover:text-[#e0e0f0]"
            }`}
            style={{
              background: activeTab === tab.id ? "#b4ff45" : "transparent",
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: "0.85rem",
            }}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: My Designs */}
      {activeTab === "designs" && (
        <div className="flex flex-col gap-3">
          {[
            { name: "My Chrome Head", date: "Apr 18, 2026", material: "chrome", stars: 5, img: "https://images.unsplash.com/photo-1684770114368-6e01b4f8741a?w=200&q=80" },
            { name: "Matte Version", date: "Apr 5, 2026", material: "matte", stars: 4, img: "https://images.unsplash.com/photo-1667761673934-70b67e527f1f?w=200&q=80" },
            { name: "Gloss Test", date: "Mar 29, 2026", material: "gloss", stars: 4, img: "https://images.unsplash.com/photo-1651557747176-5aa3c20b6780?w=200&q=80" },
          ].map((d, i) => (
            <div
              key={i}
              className="rounded-xl border border-[#1e1e35] hover:border-[#b4ff45]/25 transition-colors"
              style={{ background: "#111120" }}
            >
              <div className="flex items-center gap-4 p-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-[#252545] flex-shrink-0">
                  <img src={d.img} alt={d.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <p className="text-[#e0e0f0]" style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                    {d.name}
                  </p>
                  <p className="text-[#606080]" style={{ fontSize: "0.75rem" }}>
                    {d.date}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {Array.from({ length: d.stars }).map((_, j) => (
                      <Star key={j} className="w-3 h-3 text-[#b4ff45] fill-[#b4ff45]" />
                    ))}
                    <span
                      className="px-1.5 py-0.5 rounded capitalize"
                      style={{ background: "#1e1e35", color: "#808098", fontSize: "0.65rem" }}
                    >
                      {d.material}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1e1e35] text-[#808098] hover:border-[#b4ff45]/30 hover:text-[#b4ff45] transition-colors"
                    style={{ fontSize: "0.75rem" }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    STL
                  </button>
                  <button
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-white hover:opacity-90"
                    style={{ background: "#ff6b30", fontSize: "0.75rem", fontWeight: 600 }}
                  >
                    Reorder
                  </button>
                </div>
              </div>
            </div>
          ))}

          <button
            className="flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-[#252545] text-[#606080] hover:border-[#b4ff45]/40 hover:text-[#b4ff45] transition-colors mt-1"
            onClick={() => window.location.href = "/"}
          >
            <span style={{ fontSize: "1.2rem" }}>+</span>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Create New Design</span>
          </button>
        </div>
      )}

      {/* Tab: Orders */}
      {activeTab === "orders" && (
        <div className="flex flex-col gap-3">
          {ORDERS.map((order) => (
            <div
              key={order.id}
              className="rounded-xl border border-[#1e1e35] p-4"
              style={{ background: "#111120" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[#e0e0f0]" style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                      {order.name}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-full"
                      style={{
                        background: `${STATUS_COLORS[order.status]}18`,
                        color: STATUS_COLORS[order.status],
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        border: `1px solid ${STATUS_COLORS[order.status]}30`,
                      }}
                    >
                      {order.status}
                    </span>
                  </div>
                  <p className="text-[#606080]" style={{ fontSize: "0.75rem" }}>
                    {order.id} · {order.date} · Qty: {order.qty}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[#b4ff45]" style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                    {order.price}
                  </p>
                  <button className="flex items-center gap-1 text-[#606080] hover:text-[#e0e0f0] transition-colors mt-1" style={{ fontSize: "0.72rem" }}>
                    Details
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Settings */}
      {activeTab === "settings" && (
        <div className="flex flex-col gap-4">
          <div
            className="rounded-2xl border border-[#1e1e35] p-5"
            style={{ background: "#111120" }}
          >
            <h3 className="text-white mb-4" style={{ fontWeight: 700, fontSize: "0.95rem" }}>
              Profile
            </h3>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[#808098]" style={{ fontSize: "0.8rem" }}>
                  Display Name
                </label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="rounded-xl px-4 py-2.5 border border-[#252545] text-[#e0e0f0] focus:outline-none focus:border-[#b4ff45]/50 transition-colors"
                  style={{ background: "#0d0d1e", fontSize: "0.9rem" }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[#808098]" style={{ fontSize: "0.8rem" }}>
                  Email
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl px-4 py-2.5 border border-[#252545] text-[#e0e0f0] focus:outline-none focus:border-[#b4ff45]/50 transition-colors"
                  style={{ background: "#0d0d1e", fontSize: "0.9rem" }}
                />
              </div>
            </div>
            <button
              className="mt-4 px-5 py-2 rounded-xl text-black transition-all hover:opacity-90"
              style={{ background: "#b4ff45", fontWeight: 700, fontSize: "0.85rem" }}
            >
              Save Changes
            </button>
          </div>

          <div
            className="rounded-2xl border border-[#1e1e35] p-5"
            style={{ background: "#111120" }}
          >
            <h3 className="text-white mb-4" style={{ fontWeight: 700, fontSize: "0.95rem" }}>
              Preferences
            </h3>
            {[
              { label: "Email me when my print ships", checked: true },
              { label: "Marketing emails about new features", checked: false },
              { label: "Default to chrome material", checked: true },
            ].map((pref, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-[#1e1e35] last:border-0">
                <span className="text-[#b0b0c8]" style={{ fontSize: "0.85rem" }}>
                  {pref.label}
                </span>
                <div
                  className={`w-10 h-5.5 rounded-full relative cursor-pointer transition-colors ${pref.checked ? "bg-[#b4ff45]" : "bg-[#252545]"}`}
                  style={{ height: "22px" }}
                >
                  <div
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm"
                    style={{ transform: pref.checked ? "translateX(22px)" : "translateX(2px)" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
