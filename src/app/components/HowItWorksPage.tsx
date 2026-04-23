import { Camera, Cpu, Download, Package, ArrowRight } from "lucide-react";

const STEPS = [
  {
    icon: Camera,
    title: "1. Upload Your Photo",
    desc: "Take a front-facing photo or upload an existing one. Best results come from good lighting and a neutral background. We support JPG, PNG, HEIC and more.",
    tip: "Pro tip: Stand near a window for natural light",
    color: "#b4ff45",
  },
  {
    icon: Cpu,
    title: "2. AI Processes Your Head",
    desc: "Our system analyzes your facial geometry, extracts the head mesh, and scales it to perfectly fit a Presta valve stem connector. The neck is sized to twist-fit onto standard valve cores.",
    tip: "Processing takes about 3–5 seconds",
    color: "#4d9fff",
  },
  {
    icon: Download,
    title: "3. Download STL File",
    desc: "A production-ready STL file is generated combining your head scan with the valve stem body. It's fully manifold and ready for FDM or resin 3D printing.",
    tip: "Compatible with all major slicers: Cura, PrusaSlicer, Bambu",
    color: "#ff6b30",
  },
  {
    icon: Package,
    title: "4. Print or Order",
    desc: "Send the file to your own printer, or use our print service. We print in chrome PLA, resin, or brass-fill filament. Ships in 3–5 days.",
    tip: "Order packs of 4 for friends — perfect for group rides",
    color: "#c8a032",
  },
];

const FAQ = [
  {
    q: "What kind of 3D printer do I need?",
    a: "Any FDM printer with at least 0.2mm resolution will work. Resin printers give finer detail on the face. The stem base is designed to be printed vertically.",
  },
  {
    q: "How does my head attach to the valve stem?",
    a: "The head/neck piece has a threaded socket that screws over the top of a Presta valve. It replaces the standard dust cap and twists on in seconds.",
  },
  {
    q: "What photo works best?",
    a: "A front-facing selfie with even lighting and a plain background gives the best mesh extraction. Avoid hats, glasses, or hair covering the face.",
  },
  {
    q: "Can I use someone else's photo?",
    a: "Only with their explicit permission. By uploading a photo you confirm you have the right to use it for this purpose.",
  },
  {
    q: "Is the STL file editable?",
    a: "Yes! The STL is a standard mesh file you can open in Meshmixer, Blender, or any CAD tool to further customize.",
  },
];

export function HowItWorksPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Hero */}
      <div className="text-center mb-14">
        <h1 className="text-white mb-3" style={{ fontSize: "2.2rem", fontWeight: 800, letterSpacing: "-0.04em" }}>
          How <span style={{ color: "#b4ff45" }}>BikeHeadz</span> Works
        </h1>
        <p className="text-[#808098] max-w-xl mx-auto" style={{ fontSize: "1rem" }}>
          Four simple steps to turn your face into a 3D-printable Presta valve stem cap. 
          No 3D design experience needed.
        </p>
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-4 mb-16">
        {STEPS.map((step, i) => (
          <div key={i} className="flex items-start gap-5">
            <div className="flex flex-col items-center">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${step.color}18`, border: `1px solid ${step.color}40` }}
              >
                <step.icon className="w-5 h-5" style={{ color: step.color }} />
              </div>
              {i < STEPS.length - 1 && (
                <div className="w-px flex-1 mt-2" style={{ background: "#1e1e35", minHeight: "2rem" }} />
              )}
            </div>
            <div
              className="flex-1 rounded-2xl p-5 border border-[#1e1e35] mb-4"
              style={{ background: "#111120" }}
            >
              <h3 className="text-white mb-2" style={{ fontWeight: 700 }}>
                {step.title}
              </h3>
              <p className="text-[#808098]" style={{ fontSize: "0.88rem", lineHeight: 1.7 }}>
                {step.desc}
              </p>
              <div
                className="mt-3 px-3 py-2 rounded-lg inline-flex items-center gap-1.5"
                style={{ background: `${step.color}0f`, border: `1px solid ${step.color}25` }}
              >
                <span style={{ color: step.color, fontSize: "0.75rem", fontWeight: 600 }}>
                  💡 {step.tip}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* The Valve Stem Explained */}
      <div
        className="rounded-2xl p-6 border border-[#1e1e35] mb-10"
        style={{ background: "#111120" }}
      >
        <h2 className="text-white mb-4" style={{ fontWeight: 700 }}>
          The Valve Stem Explained
        </h2>
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <img
            src="https://images.unsplash.com/photo-1651557747176-5aa3c20b6780?w=400&q=80"
            alt="Valve stem"
            className="rounded-xl w-full md:w-56 h-40 object-cover flex-shrink-0"
          />
          <div className="flex flex-col gap-3 text-[#808098]" style={{ fontSize: "0.88rem", lineHeight: 1.7 }}>
            <p>
              A <strong className="text-white">Presta valve stem</strong> is the narrow, threaded valve found on most road and gravel bikes. It's typically 60–80mm long and 6mm in diameter.
            </p>
            <p>
              BikeHeadz replaces the standard brass dust cap with a{" "}
              <strong className="text-white">custom 3D-scanned head</strong>. The neck piece has an internal thread that matches the standard Presta valve thread — so it just screws on.
            </p>
            <p>
              Because the head sits atop the valve, it's purely decorative and doesn't interfere with inflating your tire. A tire pressure gauge or pump still works normally.
            </p>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-white mb-5" style={{ fontWeight: 700, fontSize: "1.25rem" }}>
          Frequently Asked Questions
        </h2>
        <div className="flex flex-col gap-3">
          {FAQ.map((item, i) => (
            <div
              key={i}
              className="rounded-xl p-4 border border-[#1e1e35]"
              style={{ background: "#111120" }}
            >
              <p className="text-[#e0e0f0] mb-1.5" style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                {item.q}
              </p>
              <p className="text-[#808098]" style={{ fontSize: "0.82rem", lineHeight: 1.6 }}>
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div
        className="mt-12 rounded-2xl p-8 text-center border border-[#b4ff45]/20 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0f1a05, #1a2a08)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle at 50% 0%, rgba(180,255,69,0.15), transparent 60%)" }}
        />
        <h2 className="text-white relative z-10 mb-2" style={{ fontWeight: 800, fontSize: "1.5rem" }}>
          Ready to make yours?
        </h2>
        <p className="text-[#9090b0] relative z-10 mb-6" style={{ fontSize: "0.9rem" }}>
          Takes less than a minute to generate your personalized valve stem.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-7 py-3 rounded-xl transition-all hover:opacity-90"
          style={{ background: "#b4ff45", color: "#000", fontWeight: 800, fontSize: "0.95rem" }}
        >
          Get Started Free
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
