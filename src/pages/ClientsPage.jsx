import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Gamepad2, Landmark, Cpu, Globe } from "lucide-react";

export default function ClientsPage() {
  const cases = [
    {
      id: "nebula-nine", // <--- ADD THIS ID
      client: "NEBULA NINE STUDIOS",
      project: "Galactic Horizon UI",
      category: "Video Game Design",
      desc: "Designed the diegetic user interface for the year's biggest space RPG...",
      icon: <Gamepad2 size={32} className="text-purple-500" />
    },
    {
      id: "chronos-institute", // <--- ADD THIS ID
      client: "THE CHRONOS INSTITUTE",
      project: "Artifact Curation App",
      category: "Museum Experience",
      desc: "Developed an AR guide for the Museum of Natural History...",
      icon: <Landmark size={32} className="text-amber-500" />
    },
    {
      id: "obsidian-systems", // <--- ADD THIS ID
      client: "OBSIDIAN SYSTEMS",
      project: "OS Redesign",
      category: "System Architecture",
      desc: "Overhauled the entire operating system visual language...",
      icon: <Cpu size={32} className="text-cyan-500" />
    },
    {
      id: "strategos-games", // <--- ADD THIS ID
      client: "STRATEGOS GAMES",
      project: "Tabletop Mechanics",
      category: "Board Game Design",
      desc: "Engineered the rule set and physical packaging for a strategy game...",
      icon: <Globe size={32} className="text-emerald-500" />
    }
];

  return (
    <div className="font-sans text-slate-900 bg-white min-h-screen">
      
       {/* NAV */}
       <nav className="flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-3 font-black text-2xl tracking-tighter text-slate-900">
          <img src="/brand/xplabslogo.svg" alt="XP Labs" className="h-8 w-auto" />
          XP Labs
        </Link>
        <Link to="/login" className="font-bold text-sm bg-slate-900 text-white px-4 py-2 rounded-full hover:bg-indigo-600 transition">
            EMPLOYEE LOGIN
        </Link>
      </nav>

      {/* HEADER */}
      <div className="max-w-7xl mx-auto px-6 pt-12 pb-24">
        <h1 className="text-6xl md:text-8xl font-black text-slate-900 mb-8 tracking-tighter">
          CLIENT <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">DOSSIERS.</span>
        </h1>
        <p className="text-2xl text-slate-500 max-w-3xl font-light">
          We have shaped the visual identity of Fortune 500 companies, indie darlings, and government institutions. Here is what is declassified.
        </p>
      </div>

      {/* GRID */}
      <div className="bg-slate-50 py-24 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12">
            {cases.map((item, index) => (
                <div key={index} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group">
                    <div className="flex justify-between items-start mb-8">
                        <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-indigo-50 transition">
                            {item.icon}
                        </div>
                        <span className="px-3 py-1 bg-slate-900 text-white text-xs font-bold uppercase tracking-widest rounded-full">
                            {item.category}
                        </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-400 mb-1 uppercase">{item.client}</h3>
                    <h2 className="text-3xl font-black text-slate-900 mb-4 group-hover:text-indigo-600 transition">{item.project}</h2>
                    <p className="text-slate-600 leading-relaxed mb-6">
                        {item.desc}
                    </p>
                    <Link 
  to={`/work/${item.id}`}  // <--- Use the ID here
  className="flex items-center gap-2 text-indigo-600 font-bold text-sm hover:gap-3 transition-all"
>
    VIEW CASE STUDY <ArrowRight size={16} />
</Link>
                </div>
            ))}
        </div>
      </div>
      
       {/* FOOTER CTA */}
       <div className="bg-slate-900 text-white py-24 text-center">
        <div className="max-w-2xl mx-auto px-6">
            <h2 className="text-4xl font-black mb-6">We are currently recruiting Junior Associates.</h2>
            <p className="text-slate-400 mb-8 text-lg">
                Do you have what it takes to work on our next big project? Log in to the system to begin your training.
            </p>
            <Link to="/login" className="inline-flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-full font-bold hover:bg-indigo-500 hover:scale-105 transition shadow-xl shadow-indigo-900/50">
                <ShieldCheck size={20} /> BEGIN ONBOARDING
            </Link>
        </div>
      </div>

    </div>
  );
}
