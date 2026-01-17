import { Link } from "react-router-dom";
import { Search, Lightbulb, PenTool, RefreshCw, ShieldCheck, Hexagon } from "lucide-react";

export default function ProcessPage() {
  const steps = [
    {
      id: "01",
      title: "DEEP RECONNAISSANCE",
      subtitle: "Research & Discovery",
      desc: "We don't guess. We extract data. Before a single pixel is placed, our agents conduct deep-dive analysis into the target audience, market conditions, and psychological triggers.",
      icon: <Search className="text-indigo-400" size={32} />
    },
    {
      id: "02",
      title: "SYNTHETIC IDEATION",
      subtitle: "Brainstorming & Concept",
      desc: "Chaos into order. We generate hundreds of potential divergent vectors before converging on the singular, optimal solution. No idea is too dangerous during this phase.",
      icon: <Lightbulb className="text-yellow-400" size={32} />
    },
    {
      id: "03",
      title: "PRECISION ARCHITECTURE",
      subtitle: "Prototyping & Creation",
      desc: "Blueprints for reality. We build low-fidelity structures to test viability, then scale up to high-fidelity production assets. This is where the work gets real.",
      icon: <PenTool className="text-cyan-400" size={32} />
    },
    {
      id: "04",
      title: "ITERATIVE REFINEMENT",
      subtitle: "Feedback & Polish",
      desc: "Perfection is a moving target. We stress-test every design against rigorous quality control metrics. We break it, fix it, and polish it until it gleams.",
      icon: <RefreshCw className="text-green-400" size={32} />
    }
  ];

  return (
    <div className="font-sans text-slate-900 bg-slate-50 min-h-screen">
      
      {/* NAV (Simplified) */}
      <nav className="flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-2 font-black text-2xl tracking-tighter text-slate-900">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
            <Hexagon size={20} fill="currentColor" />
          </div>
          DREAM<span className="text-indigo-600">AGENCY</span>
        </Link>
        <Link to="/login" className="font-bold text-sm bg-slate-900 text-white px-4 py-2 rounded-full hover:bg-indigo-600 transition">
            EMPLOYEE LOGIN
        </Link>
      </nav>

      {/* HERO */}
      <div className="bg-slate-900 text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-black mb-6 tracking-tight">THE PROTOCOL</h1>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                Our methodology is rigorous, scientific, and repeatable. We do not rely on "inspiration." We rely on The Process.
            </p>
        </div>
      </div>

      {/* STEPS */}
      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="space-y-12">
            {steps.map((step, index) => (
                <div key={index} className="group flex flex-col md:flex-row gap-8 items-start bg-white p-8 rounded-2xl border border-slate-200 hover:shadow-xl hover:border-indigo-200 transition-all duration-300">
                    <div className="w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition duration-300 shadow-lg">
                        {step.icon}
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-5xl font-black text-slate-100">{step.id}</span>
                            <h3 className="text-xl font-bold text-indigo-600 uppercase tracking-wider">{step.subtitle}</h3>
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 mb-4">{step.title}</h2>
                        <p className="text-slate-500 leading-relaxed text-lg">{step.desc}</p>
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* FOOTER CTA */}
      <div className="bg-indigo-600 text-white py-20 text-center">
        <h2 className="text-3xl font-bold mb-6">Think you can handle The Protocol?</h2>
        <Link to="/login" className="inline-flex items-center gap-2 bg-white text-indigo-600 px-8 py-4 rounded-full font-bold hover:bg-slate-900 hover:text-white transition shadow-xl">
            <ShieldCheck size={20} /> ACCESS EMPLOYEE PORTAL
        </Link>
      </div>
    </div>
  );
}