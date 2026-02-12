import { useParams, Link, Navigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, Layers, Cpu, Zap, ArrowRight } from "lucide-react";

// --- THE LORE DATABASE ---
const CASE_STUDIES = {
  "nebula-nine": {
    client: "NEBULA NINE STUDIOS",
    title: "Galactic Horizon UI",
    color: "from-purple-600 to-indigo-900",
    tags: ["Game UI", "UX Research", "Motion Design"],
    stats: {
      timeline: "8 Months",
      deliverables: "HUD, Menus, Iconography",
      outcome: "15% Reduction in Player Fatigue"
    },
    brief: "Nebula Nine came to us with a critical problem: Players in their massive space RPG were getting overwhelmed by data. They needed a 'diegetic' interface—one that felt like it existed inside the game world, not just a sticker on top of the screen.",
    solution: "We engineered a holographic design system. Instead of static text, we used spatial depth to organize information. Critical combat data floats closest to the player's view, while inventory management sits in the peripheral vision. We conducted eye-tracking studies on 50 beta testers to ensure the health bar was visible without breaking immersion.",
    quote: "XP Labs didn't just design a menu; they designed the nervous system of our game.",
    images: ["bg-purple-900", "bg-indigo-800", "bg-slate-900"] // Placeholder classes for "images"
  },
  "chronos-institute": {
    client: "THE CHRONOS INSTITUTE",
    title: "Artifact Curation App",
    color: "from-amber-500 to-orange-700",
    tags: ["Augmented Reality", "Mobile App", "Education"],
    stats: {
      timeline: "12 Weeks",
      deliverables: "AR Prototype, iOS App",
      outcome: "400% Increase in Youth Engagement"
    },
    brief: "Museums are fighting a losing battle against smartphones. The Chronos Institute needed to turn the phone from a distraction into a lens. They asked us to make dinosaur fossils 'come alive' without damaging the scientific integrity of the exhibit.",
    solution: "We utilized LiDAR scanning technology to map the museum's skeletal mounts. Our application overlays muscle and skin textures onto the bones in real-time. Students can hold up their iPad and watch a T-Rex breathe. We also gamified the learning process, allowing visitors to 'collect' DNA samples from different exhibits to unlock badges.",
    quote: "Finally, history feels like the future. Student attendance has skyrocketed.",
    images: ["bg-amber-100", "bg-orange-100", "bg-stone-200"]
  },
  "obsidian-systems": {
    client: "OBSIDIAN SYSTEMS",
    title: "OS Redesign",
    color: "from-cyan-600 to-slate-800",
    tags: ["System Architecture", "Accessibility", "Security"],
    stats: {
      timeline: "1.5 Years",
      deliverables: "Design System, Component Library",
      outcome: "Zero Critical Errors in Field Tests"
    },
    brief: "Obsidian builds servers for high-stress environments (arctic research bases, deep-sea rigs). Their previous OS was ugly and hard to read in low light. A mistake in this interface doesn't mean a lost file; it means a system meltdown.",
    solution: "We stripped away all decoration. We created 'Dark Mode 2.0,' a high-contrast theme designed specifically for tired eyes in dark rooms. We used monospaced typography for data tables to prevent reading errors and color-coded alert systems that work even for colorblind operators.",
    quote: "It looks like something from a movie, but it works like a tank. Absolute precision.",
    images: ["bg-slate-800", "bg-cyan-900", "bg-slate-900"]
  },
  "strategos-games": {
    client: "STRATEGOS GAMES",
    title: "Tabletop Mechanics",
    color: "from-emerald-600 to-teal-800",
    tags: ["Packaging", "Print Design", "Game Theory"],
    stats: {
      timeline: "6 Months",
      deliverables: "Box Art, Card Layouts, 3D Models",
      outcome: "$2M Kickstarter Campaign"
    },
    brief: "Strategos had a brilliant game mechanic about Cold War espionage, but the prototype was just index cards and scribbles. They needed a visual identity that screamed 'Top Secret' and felt expensive to the touch.",
    solution: "We treated the box like a classified dossier. We used matte black paper with spot-gloss UV coating for secret messages that only appear under light. The cards were designed with clear iconography to speed up gameplay. We didn't just design the look; we helped refine the rulebook to make it easier for new players to learn.",
    quote: "The unboxing experience alone sold the game. XP Labs understands tactility.",
    images: ["bg-emerald-900", "bg-teal-800", "bg-stone-800"]
  }
};

export default function CaseStudyDetail() {
  const { id } = useParams();
  const study = CASE_STUDIES[id];

  if (!study) return <Navigate to="/clients" />;

  return (
    <div className="font-sans text-slate-900 bg-white min-h-screen">
      
      {/* NAV */}
      <nav className="flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-3 font-black text-2xl tracking-tighter text-slate-900">
          <img src="/brand/xplabslogo.png" alt="XP Labs" className="h-9 w-9 object-cover" />
          XP Labs
        </Link>
        <Link to="/clients" className="flex items-center gap-2 font-bold text-sm text-slate-500 hover:text-indigo-600 transition">
            <ArrowLeft size={16} /> BACK TO DOSSIERS
        </Link>
      </nav>

      {/* HERO HEADER */}
      <div className={`w-full py-32 bg-gradient-to-br ${study.color} text-white`}>
        <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center gap-3 mb-6 opacity-80">
                <span className="font-bold tracking-widest uppercase">{study.client}</span>
                <span className="w-1 h-1 bg-white rounded-full"></span>
                <span className="font-mono text-sm">CASE_ID: {id.toUpperCase()}</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black mb-8 leading-tight">{study.title}</h1>
            <div className="flex flex-wrap gap-3">
                {study.tags.map((tag, i) => (
                    <span key={i} className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full font-bold text-sm">
                        {tag}
                    </span>
                ))}
            </div>
        </div>
      </div>

      {/* STATS BAR */}
      <div className="bg-slate-900 text-white py-12 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Timeline</p>
                <p className="text-2xl font-bold">{study.stats.timeline}</p>
            </div>
            <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Deliverables</p>
                <p className="text-2xl font-bold">{study.stats.deliverables}</p>
            </div>
            <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Outcome</p>
                <p className="text-2xl font-bold text-green-400">{study.stats.outcome}</p>
            </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-20">
        
        {/* Left: Text */}
        <div className="space-y-16">
            <div className="group">
                <h2 className="text-3xl font-black text-slate-900 mb-6 flex items-center gap-3">
                    <div className="bg-red-100 text-red-600 p-2 rounded-lg"><Layers size={24}/></div>
                    THE BRIEF
                </h2>
                <p className="text-xl text-slate-600 leading-relaxed">
                    {study.brief}
                </p>
            </div>

            <div>
                <h2 className="text-3xl font-black text-slate-900 mb-6 flex items-center gap-3">
                    <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg"><Cpu size={24}/></div>
                    THE SOLUTION
                </h2>
                <p className="text-xl text-slate-600 leading-relaxed mb-8">
                    {study.solution}
                </p>
                <blockquote className="border-l-4 border-indigo-600 pl-6 py-2 italic text-slate-500 text-lg">
                    "{study.quote}"
                </blockquote>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Zap size={20} className="text-yellow-500" /> Lab Note
                </h3>
                <p className="text-slate-600">
                    This project required <strong>{study.tags[1]}</strong>. If you are interested in this career path, check the "Available Contracts" in your dashboard for related tasks.
                </p>
            </div>
        </div>

        {/* Right: Abstract Visuals */}
        <div className="space-y-6">
            {/* Main Visual */}
            <div className={`w-full aspect-video rounded-3xl shadow-2xl ${study.images[0]} flex items-center justify-center relative overflow-hidden group`}>
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition duration-500"></div>
                <span className="text-white/50 font-black text-4xl tracking-tighter mix-blend-overlay">FIG. 01</span>
            </div>

            {/* Secondary Grid */}
            <div className="grid grid-cols-2 gap-6">
                <div className={`w-full aspect-square rounded-3xl ${study.images[1]} flex items-center justify-center`}>
                    <span className="text-white/50 font-black text-xl mix-blend-overlay">FIG. 02</span>
                </div>
                <div className={`w-full aspect-square rounded-3xl ${study.images[2]} flex items-center justify-center`}>
                     <span className="text-white/50 font-black text-xl mix-blend-overlay">FIG. 03</span>
                </div>
            </div>
        </div>

      </div>

      {/* FOOTER NAV */}
      <div className="bg-slate-50 border-t border-slate-200 py-20 text-center">
        <h2 className="text-2xl font-bold mb-8 text-slate-400">View other declassified files</h2>
        <div className="flex justify-center gap-4">
            <Link to="/clients" className="inline-flex items-center gap-2 bg-white border border-slate-300 px-6 py-3 rounded-full font-bold hover:bg-slate-100 transition">
                <ArrowLeft size={18}/> Client Index
            </Link>
            <Link to="/login" className="inline-flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-full font-bold hover:bg-indigo-600 transition shadow-lg">
                Start Your Training <ArrowRight size={18}/>
            </Link>
        </div>
      </div>

    </div>
  );
}
