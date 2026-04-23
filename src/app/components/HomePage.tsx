import { useState, useRef, useCallback, Suspense } from "react";
import {
  Upload,
  RefreshCw,
  Download,
  Settings2,
  Zap,
  ChevronRight,
  Star,
  Calendar,
  Megaphone,
  ImageIcon,
  RotateCcw,
  Layers,
  CreditCard,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ValveStem3DViewer } from "./ValveStem3DViewer";

// ---- Types & mock data -----------------------------------------------

type MaterialType = "matte" | "gloss" | "chrome";

interface PreviousDesign {
  id: string;
  name: string;
  date: string;
  thumbnail: string;
  material: MaterialType;
  stars: number;
}

const MOCK_DESIGNS: PreviousDesign[] = [
  {
    id: "1",
    name: "Alex's Head",
    date: "Apr 18, 2026",
    thumbnail: "https://images.unsplash.com/photo-1684770114368-6e01b4f8741a?w=200&q=80",
    material: "chrome",
    stars: 5,
  },
  {
    id: "2",
    name: "Jordan Stem",
    date: "Apr 12, 2026",
    thumbnail: "https://images.unsplash.com/photo-1667761673934-70b67e527f1f?w=200&q=80",
    material: "gloss",
    stars: 4,
  },
  {
    id: "3",
    name: "Sam Rider",
    date: "Mar 29, 2026",
    thumbnail: "https://images.unsplash.com/photo-1651557747176-5aa3c20b6780?w=200&q=80",
    material: "matte",
    stars: 5,
  },
];

const EVENTS = [
  {
    id: "e1",
    title: "SF Bike Fest 2026",
    date: "May 10",
    location: "San Francisco, CA",
    img: "https://images.unsplash.com/photo-1774266854673-3f03daa491d6?w=400&q=80",
  },
  {
    id: "e2",
    title: "Urban Cycle Expo",
    date: "Jun 4",
    location: "Portland, OR",
    img: "https://images.unsplash.com/photo-1774165098214-4abca7edc1cb?w=400&q=80",
  },
];

// ---- Utility -----------------------------------------------------------

function generateMockSTL(): string {
  const triangles: string[] = [];
  // Generate a simple sphere approximation
  const r = 8;
  const steps = 12;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const t1 = (i / steps) * Math.PI;
      const t2 = ((i + 1) / steps) * Math.PI;
      const p1 = (j / steps) * 2 * Math.PI;
      const p2 = ((j + 1) / steps) * 2 * Math.PI;

      const v = (t: number, p: number) => ({
        x: +(r * Math.sin(t) * Math.cos(p)).toFixed(6),
        y: +(r * Math.cos(t)).toFixed(6),
        z: +(r * Math.sin(t) * Math.sin(p)).toFixed(6),
      });
      const nx = (t: number, p: number) => ({
        x: +(Math.sin(t) * Math.cos(p)).toFixed(6),
        y: +(Math.cos(t)).toFixed(6),
        z: +(Math.sin(t) * Math.sin(p)).toFixed(6),
      });

      const a = v(t1, p1), b = v(t1, p2), c = v(t2, p1), d = v(t2, p2);
      const n = nx((t1 + t2) / 2, (p1 + p2) / 2);
      triangles.push(
        `facet normal ${n.x} ${n.y} ${n.z}\n  outer loop\n    vertex ${a.x} ${a.y} ${a.z}\n    vertex ${b.x} ${b.y} ${b.z}\n    vertex ${c.x} ${c.y} ${c.z}\n  endloop\nendfacet`,
        `facet normal ${n.x} ${n.y} ${n.z}\n  outer loop\n    vertex ${b.x} ${b.y} ${b.z}\n    vertex ${d.x} ${d.y} ${d.z}\n    vertex ${c.x} ${c.y} ${c.z}\n  endloop\nendfacet`
      );
    }
  }
  return `solid BikeHeadz_ValveStem\n${triangles.join("\n")}\nendsolid BikeHeadz_ValveStem`;
}

// ---- Main Page ---------------------------------------------------------

export function HomePage() {
  // Photo state
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Processing / generation state
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stlReady, setStlReady] = useState(false);
  const [processingStep, setProcessingStep] = useState("");

  // 3D settings
  const [headScale, setHeadScale] = useState(0.85);
  const [neckLength, setNeckLength] = useState(50);
  const [headTilt, setHeadTilt] = useState(0);
  const [materialType, setMaterialType] = useState<MaterialType>("chrome");
  const [headColor, setHeadColor] = useState("#c8b8a0");
  const [showSettings, setShowSettings] = useState(false);

  // Previous designs selected
  const [selectedDesign, setSelectedDesign] = useState<string | null>(null);

  // Handle file input
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    setPhotoFile(file);
    setStlReady(false);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  // Generate / process
  const handleGenerate = async () => {
    if (!photoUrl) return;
    setProcessing(true);
    setStlReady(false);
    setProgress(0);

    const steps = [
      "Analyzing facial geometry...",
      "Extracting head mesh...",
      "Scaling to valve dimensions...",
      "Merging with stem base...",
      "Generating STL manifold...",
      "Finalizing print file...",
    ];

    for (let i = 0; i < steps.length; i++) {
      setProcessingStep(steps[i]);
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 300));
      setProgress(Math.round(((i + 1) / steps.length) * 100));
    }

    setProcessing(false);
    setStlReady(true);
    setProcessingStep("");
  };

  // Download STL
  const handleDownload = () => {
    const stl = generateMockSTL();
    const blob = new Blob([stl], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "BikeHeadz_ValveStem.stl";
    a.click();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_260px] gap-6">
        {/* ===== LEFT SIDEBAR: Ads + Events ===== */}
        <aside className="hidden lg:flex flex-col gap-4">
          {/* Section label */}
          <div className="flex items-center gap-2 mb-1">
            <Megaphone className="w-4 h-4 text-[#b4ff45]" />
            <span className="text-[#9090b0] uppercase tracking-wider" style={{ fontSize: "0.7rem", fontWeight: 700 }}>
              Ads & Events
            </span>
          </div>

          {/* Events */}
          {EVENTS.map((ev) => (
            <div
              key={ev.id}
              className="rounded-xl overflow-hidden border border-[#1e1e35] hover:border-[#b4ff45]/30 transition-colors cursor-pointer group"
              style={{ background: "#111120" }}
            >
              <div className="relative h-28 overflow-hidden">
                <img
                  src={ev.img}
                  alt={ev.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }} />
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-[#b4ff45]" />
                  <span className="text-white" style={{ fontSize: "0.7rem", fontWeight: 700 }}>{ev.date}</span>
                </div>
              </div>
              <div className="p-3">
                <p className="text-[#e0e0f0]" style={{ fontSize: "0.8rem", fontWeight: 600 }}>{ev.title}</p>
                <p className="text-[#6060808]" style={{ fontSize: "0.7rem", color: "#808098" }}>{ev.location}</p>
              </div>
            </div>
          ))}

          {/* Ad banner */}
          <div
            className="rounded-xl p-4 border border-[#b4ff45]/20 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #0f1a05, #1a2a08)" }}
          >
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 70% 30%, #b4ff45 0%, transparent 60%)",
              }}
            />
            <p className="text-[#b4ff45] relative z-10" style={{ fontSize: "0.75rem", fontWeight: 700 }}>
              🚴 Free Shipping
            </p>
            <p className="text-[#9090b0] relative z-10 mt-1" style={{ fontSize: "0.7rem" }}>
              On all printed stems when you order 3+
            </p>
            <button className="mt-3 relative z-10 text-[#b4ff45] border border-[#b4ff45]/40 rounded-lg px-3 py-1 hover:bg-[#b4ff45]/10 transition-colors" style={{ fontSize: "0.72rem" }}>
              Order Now
            </button>
          </div>

          <div
            className="rounded-xl p-4 border border-[#1e1e35] overflow-hidden"
            style={{ background: "#111120" }}
          >
            <img
              src="https://images.unsplash.com/photo-1697162123803-b812798e61e2?w=400&q=80"
              alt="Bike parts"
              className="w-full h-20 object-cover rounded-lg mb-3"
            />
            <p className="text-[#e0e0f0]" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
              Custom Valve Caps
            </p>
            <p className="text-[#808098]" style={{ fontSize: "0.7rem" }}>
              Brass, aluminum, titanium options
            </p>
          </div>
        </aside>

        {/* ===== CENTER: Main Generator ===== */}
        <section className="flex flex-col gap-5">
          {/* Page title */}
          <div>
            <h1 className="text-white" style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.03em" }}>
              Your Head on a{" "}
              <span style={{ color: "#b4ff45" }}>Valve Stem</span>
            </h1>
            <p className="text-[#808098] mt-1" style={{ fontSize: "0.9rem" }}>
              Upload a photo → get a 3D-printable STL file personalized to you
            </p>
          </div>

          {/* Photo Upload */}
          <div
            className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer ${
              dragging
                ? "border-[#b4ff45] bg-[#b4ff45]/5"
                : photoUrl
                ? "border-[#252545] bg-[#111120]"
                : "border-[#252545] hover:border-[#b4ff45]/50 bg-[#111120]"
            }`}
            onClick={() => !photoUrl && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileChange}
            />

            {photoUrl ? (
              <div className="flex items-center gap-4 p-4">
                <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border border-[#252545]">
                  <img src={photoUrl} alt="Uploaded" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white" style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                    {photoFile?.name ?? "Photo uploaded"}
                  </p>
                  <p className="text-[#808098]" style={{ fontSize: "0.78rem" }}>
                    Ready to generate your valve stem
                  </p>
                </div>
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#252545] text-[#9090b0] hover:text-[#e0e0f0] hover:border-[#b4ff45]/40 transition-colors"
                  style={{ fontSize: "0.78rem" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Change Photo
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #1a2a08, #0f1a05)", border: "1px solid #b4ff45/30" }}
                >
                  <Upload className="w-6 h-6 text-[#b4ff45]" />
                </div>
                <div className="text-center">
                  <p className="text-white" style={{ fontWeight: 600 }}>
                    Upload Your Photo
                  </p>
                  <p className="text-[#808098] mt-1" style={{ fontSize: "0.82rem" }}>
                    Drag & drop or click to browse · JPG, PNG, HEIC
                  </p>
                </div>
                <button
                  className="px-5 py-2 rounded-xl text-black transition-all hover:opacity-90"
                  style={{ background: "#b4ff45", fontWeight: 700, fontSize: "0.88rem" }}
                >
                  Choose Photo
                </button>
              </div>
            )}
          </div>

          {/* 3D Model Preview */}
          <div
            className="rounded-2xl overflow-hidden border border-[#1e1e35]"
            style={{ background: "#0d0d1e" }}
          >
            {/* Viewer header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e35]">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#b4ff45]" />
                <span className="text-[#e0e0f0]" style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                  3D Model Preview
                </span>
                {processing && (
                  <span
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                    style={{ background: "#b4ff45/15", backgroundColor: "rgba(180,255,69,0.12)", fontSize: "0.7rem", color: "#b4ff45" }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#b4ff45] animate-pulse inline-block" />
                    Processing
                  </span>
                )}
                {stlReady && (
                  <span
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "rgba(180,255,69,0.12)", fontSize: "0.7rem", color: "#b4ff45" }}
                  >
                    ✓ STL Ready
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[#606080]" style={{ fontSize: "0.72rem" }}>
                <RotateCcw className="w-3.5 h-3.5" />
                Drag to rotate
              </div>
            </div>

            {/* Canvas */}
            <div style={{ height: "380px" }}>
              <ValveStem3DViewer
                headScale={headScale}
                neckLength={neckLength}
                headTilt={headTilt}
                materialType={materialType}
                headColor={headColor}
                photoUrl={photoUrl}
                processing={processing}
              />
            </div>

            {/* Annotation row */}
            <div className="px-4 py-3 border-t border-[#1e1e35] flex items-center gap-6" style={{ fontSize: "0.75rem" }}>
              <div className="flex items-center gap-1.5 text-[#808098]">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#b4ff45" }} />
                3D Scanned Head
              </div>
              <div className="flex items-center gap-1.5 text-[#808098]">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#c8a032" }} />
                Presta Valve Stem
              </div>
              <div className="flex items-center gap-1.5 text-[#808098]">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#c0c0d0" }} />
                Chrome Body
              </div>
            </div>
          </div>

          {/* Settings toggle */}
          <button
            className="flex items-center justify-between w-full px-4 py-3 rounded-xl border border-[#1e1e35] hover:border-[#b4ff45]/30 transition-colors text-left"
            style={{ background: "#111120" }}
            onClick={() => setShowSettings(!showSettings)}
          >
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-[#b4ff45]" />
              <span className="text-[#e0e0f0]" style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                Adjust 3D Settings
              </span>
            </div>
            <ChevronRight
              className="w-4 h-4 text-[#606080] transition-transform"
              style={{ transform: showSettings ? "rotate(90deg)" : "rotate(0deg)" }}
            />
          </button>

          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div
                  className="rounded-2xl border border-[#1e1e35] p-5 grid grid-cols-1 sm:grid-cols-2 gap-5"
                  style={{ background: "#111120" }}
                >
                  {/* Head Scale */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[#b0b0c8]" style={{ fontSize: "0.8rem" }}>
                        Head Scale
                      </label>
                      <span className="text-[#b4ff45]" style={{ fontSize: "0.8rem", fontWeight: 700 }}>
                        {(headScale * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={1.5}
                      step={0.05}
                      value={headScale}
                      onChange={(e) => setHeadScale(+e.target.value)}
                      className="w-full accent-[#b4ff45]"
                      style={{ accentColor: "#b4ff45" }}
                    />
                  </div>

                  {/* Neck Length */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[#b0b0c8]" style={{ fontSize: "0.8rem" }}>
                        Neck Length
                      </label>
                      <span className="text-[#b4ff45]" style={{ fontSize: "0.8rem", fontWeight: 700 }}>
                        {neckLength}mm
                      </span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={80}
                      step={5}
                      value={neckLength}
                      onChange={(e) => setNeckLength(+e.target.value)}
                      className="w-full"
                      style={{ accentColor: "#b4ff45" }}
                    />
                  </div>

                  {/* Head Tilt */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[#b0b0c8]" style={{ fontSize: "0.8rem" }}>
                        Head Tilt
                      </label>
                      <span className="text-[#b4ff45]" style={{ fontSize: "0.8rem", fontWeight: 700 }}>
                        {headTilt > 0 ? `+${headTilt}` : headTilt}°
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-15}
                      max={15}
                      step={1}
                      value={headTilt}
                      onChange={(e) => setHeadTilt(+e.target.value)}
                      className="w-full"
                      style={{ accentColor: "#b4ff45" }}
                    />
                  </div>

                  {/* Head Color */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[#b0b0c8]" style={{ fontSize: "0.8rem" }}>
                      Head Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={headColor}
                        onChange={(e) => setHeadColor(e.target.value)}
                        className="w-10 h-8 rounded cursor-pointer border border-[#252545]"
                      />
                      <span className="text-[#606080]" style={{ fontSize: "0.78rem" }}>
                        {headColor}
                      </span>
                    </div>
                  </div>

                  {/* Material */}
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label className="text-[#b0b0c8]" style={{ fontSize: "0.8rem" }}>
                      Material Finish
                    </label>
                    <div className="flex gap-2">
                      {(["matte", "gloss", "chrome"] as MaterialType[]).map((m) => (
                        <button
                          key={m}
                          onClick={() => setMaterialType(m)}
                          className={`flex-1 py-2 rounded-xl capitalize border transition-all ${
                            materialType === m
                              ? "border-[#b4ff45] text-[#b4ff45]"
                              : "border-[#252545] text-[#808098] hover:border-[#b4ff45]/30 hover:text-[#e0e0f0]"
                          }`}
                          style={{
                            background: materialType === m ? "rgba(180,255,69,0.08)" : "#0d0d1e",
                            fontSize: "0.82rem",
                            fontWeight: 600,
                          }}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Generate + Download buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleGenerate}
              disabled={!photoUrl || processing}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl transition-all duration-200 ${
                !photoUrl || processing
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]"
              }`}
              style={{
                background: !photoUrl || processing
                  ? "#252545"
                  : "linear-gradient(135deg, #b4ff45, #7fc718)",
                color: "#000",
                fontWeight: 800,
                fontSize: "0.95rem",
              }}
            >
              {processing ? (
                <>
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  {processingStep || "Generating…"} {progress}%
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  {stlReady ? "Re-generate STL" : "Generate 3D File"}
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              disabled={!stlReady}
              className={`flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border transition-all duration-200 ${
                stlReady
                  ? "border-[#b4ff45]/40 text-[#b4ff45] hover:bg-[#b4ff45]/10 hover:scale-[1.01]"
                  : "border-[#252545] text-[#404055] cursor-not-allowed"
              }`}
              style={{ background: "#111120", fontWeight: 700, fontSize: "0.9rem" }}
            >
              <Download className="w-4 h-4" />
              Download STL
            </button>

            <button
              disabled={!stlReady}
              className={`flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl transition-all duration-200 ${
                stlReady
                  ? "hover:opacity-90 hover:scale-[1.01]"
                  : "opacity-40 cursor-not-allowed"
              }`}
              style={{
                background: stlReady ? "linear-gradient(135deg, #ff6b30, #e8450a)" : "#252545",
                color: "#fff",
                fontWeight: 700,
                fontSize: "0.9rem",
              }}
            >
              <CreditCard className="w-4 h-4" />
              Pay & Print
            </button>
          </div>

          {stlReady && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl px-4 py-3 border border-[#b4ff45]/25 flex items-center gap-3"
              style={{ background: "rgba(180,255,69,0.06)" }}
            >
              <span className="text-2xl">🎉</span>
              <div>
                <p className="text-[#b4ff45]" style={{ fontWeight: 700, fontSize: "0.88rem" }}>
                  Your STL is ready!
                </p>
                <p className="text-[#808098]" style={{ fontSize: "0.78rem" }}>
                  Download the file and send to your 3D printer, or click Pay & Print to have us print it for you.
                </p>
              </div>
            </motion.div>
          )}
        </section>

        {/* ===== RIGHT SIDEBAR: Previous 3D Designs ===== */}
        <aside className="flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-1">
            <ImageIcon className="w-4 h-4 text-[#b4ff45]" />
            <span className="text-[#9090b0] uppercase tracking-wider" style={{ fontSize: "0.7rem", fontWeight: 700 }}>
              Previous 3D Designs
            </span>
          </div>

          {/* Valve stem illustration card */}
          <div
            className="rounded-xl overflow-hidden border border-[#1e1e35] relative"
            style={{ background: "#111120" }}
          >
            <img
              src="https://images.unsplash.com/photo-1651557747176-5aa3c20b6780?w=600&q=80"
              alt="Valve stem"
              className="w-full h-32 object-cover"
            />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(17,17,32,0.9), transparent 50%)" }} />
            <div className="absolute bottom-3 left-3">
              <p className="text-white" style={{ fontWeight: 700, fontSize: "0.82rem" }}>
                Presta Valve Base
              </p>
              <p className="text-[#b4ff45]" style={{ fontSize: "0.7rem" }}>
                Standard compatible
              </p>
            </div>
          </div>

          {/* Design cards */}
          {MOCK_DESIGNS.map((design) => (
            <button
              key={design.id}
              onClick={() => setSelectedDesign(design.id === selectedDesign ? null : design.id)}
              className={`w-full text-left rounded-xl overflow-hidden border transition-all duration-200 ${
                selectedDesign === design.id
                  ? "border-[#b4ff45]/50"
                  : "border-[#1e1e35] hover:border-[#b4ff45]/25"
              }`}
              style={{ background: "#111120" }}
            >
              <div className="flex items-center gap-3 p-3">
                <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-[#1e1e35]">
                  <img
                    src={design.thumbnail}
                    alt={design.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#e0e0f0] truncate" style={{ fontWeight: 600, fontSize: "0.82rem" }}>
                    {design.name}
                  </p>
                  <p className="text-[#606080]" style={{ fontSize: "0.72rem" }}>
                    {design.date}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {Array.from({ length: design.stars }).map((_, i) => (
                      <Star key={i} className="w-3 h-3 text-[#b4ff45] fill-[#b4ff45]" />
                    ))}
                    <span
                      className="ml-1 px-1.5 py-0.5 rounded capitalize"
                      style={{
                        background: "#1e1e35",
                        color: "#808098",
                        fontSize: "0.65rem",
                      }}
                    >
                      {design.material}
                    </span>
                  </div>
                </div>
              </div>
              {selectedDesign === design.id && (
                <div className="px-3 pb-3 flex gap-2">
                  <button
                    className="flex-1 py-1.5 rounded-lg border border-[#b4ff45]/30 text-[#b4ff45] hover:bg-[#b4ff45]/10 transition-colors"
                    style={{ fontSize: "0.72rem", fontWeight: 600 }}
                    onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                  >
                    Download
                  </button>
                  <button
                    className="flex-1 py-1.5 rounded-lg transition-colors text-white hover:opacity-90"
                    style={{ background: "#ff6b30", fontSize: "0.72rem", fontWeight: 600 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Reorder
                  </button>
                </div>
              )}
            </button>
          ))}

          {/* Info box */}
          <div
            className="rounded-xl p-4 border border-[#1e1e35] mt-1"
            style={{ background: "#111120" }}
          >
            <p className="text-[#e0e0f0]" style={{ fontWeight: 700, fontSize: "0.82rem" }}>
              Pricing
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              {[
                { label: "STL Download", price: "$4.99" },
                { label: "Printed Stem", price: "$19.99" },
                { label: "Pack of 4", price: "$59.99" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className="text-[#808098]" style={{ fontSize: "0.75rem" }}>
                    {item.label}
                  </span>
                  <span className="text-[#b4ff45]" style={{ fontSize: "0.78rem", fontWeight: 700 }}>
                    {item.price}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
