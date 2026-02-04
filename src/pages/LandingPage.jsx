import { useState } from "react";
import { Link } from "react-router-dom";
import { 
    ArrowRight, Layers, PenTool, Globe, 
    ShieldCheck, X, CheckCircle, Loader2, Send 
} from "lucide-react";

export default function LandingPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState("idle"); // idle, submitting, success

  const handleOpen = () => {
      setIsModalOpen(true);
      setFormState("idle");
  };

  const handleSubmit = (e) => {
      e.preventDefault();
      setFormState("submitting");
      
      // Fake API delay
      setTimeout(() => {
          setFormState("success");
      }, 1500);
  };

  return (
    <div className="font-sans text-slate-900 bg-white overflow-x-hidden relative">
      
      {/* --- NAVBAR --- */}
      <nav className="flex items-center justify-between px-6 py-6 max-w-7xl mx-auto relative z-20">
        <div className="flex items-center gap-3 font-black text-2xl tracking-tighter text-slate-900">
          <img src="/brand/xplabslogo.svg" alt="XP Labs" className="h-8 w-auto" />
          XP Labs
        </div>

        <div className="hidden md:flex gap-8 font-bold text-slate-500 text-sm">
          <Link to="/clients" className="hover:text-indigo-600 transition">OUR WORK</Link>
          <Link to="/process" className="hover:text-indigo-600 transition">THE PROCESS</Link>
          <Link to="/clients" className="hover:text-indigo-600 transition">CLIENTS</Link>
        </div>

        <Link 
          to="/login" 
          className="group flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-full font-bold text-sm hover:bg-indigo-600 hover:scale-105 transition-all shadow-lg shadow-indigo-500/20"
        >
          <ShieldCheck size={16} className="text-indigo-400 group-hover:text-white transition" />
          EMPLOYEE PORTAL
        </Link>
      </nav>

      {/* --- HERO SECTION --- */}
      <div className="relative pt-20 pb-32 lg:pt-32 lg:pb-48 overflow-hidden">
        
        {/* Angled Background */}
        <div className="absolute top-0 left-0 w-full h-full bg-slate-50 -skew-y-3 origin-top-left z-0 transform scale-110"></div>
        
        {/* Floating Blobs */}
        <div className="absolute top-20 right-[-100px] w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl z-0"></div>
        <div className="absolute bottom-0 left-[-100px] w-72 h-72 bg-cyan-400/20 rounded-full blur-3xl z-0"></div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 font-bold text-xs rounded-full mb-6 tracking-wide">
              EST. 2024 • GLOBAL DESIGN LEADER
            </div>
            <h1 className="text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] mb-6 text-slate-900">
              We engineer <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500">
                impossible realities.
              </span>
            </h1>
            <p className="text-xl text-slate-500 font-medium mb-8 max-w-lg leading-relaxed">
              XP Labs creates brand experiences for the world's most ambitious companies. We turn abstract concepts into design dominance.
            </p>
            <div className="flex gap-4">
               {/* BUTTON TRIGGERS MODAL */}
               <button 
                  onClick={handleOpen}
                  className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-indigo-700 transition shadow-xl shadow-indigo-200 flex items-center gap-2"
                >
                 Start a Project <ArrowRight size={18} />
               </button>
               
               <Link to="/clients" className="bg-white text-slate-900 border border-slate-200 px-8 py-4 rounded-xl font-bold hover:bg-slate-50 transition flex items-center justify-center">
                 View Showreel
               </Link>
            </div>
          </div>

          {/* Abstract Graphic */}
          <div className="relative hidden lg:block">
             <div className="bg-slate-900 rounded-2xl p-6 shadow-2xl transform rotate-3 hover:rotate-0 transition duration-500 border border-slate-800">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-700 pb-4">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <div className="ml-auto text-xs font-mono text-slate-500">MAIN_RENDER.js</div>
                </div>
                <div className="space-y-3 font-mono text-sm">
                    <div className="text-green-400">SUCCESS: Render complete.</div>
                    <div className="text-slate-400">Optimizing geometry...</div>
                    <div className="text-indigo-400">Loading assets: [####################] 100%</div>
                    <div className="p-4 bg-slate-800 rounded mt-4 border border-slate-700 text-cyan-300">
                        {`{ "agency": "XP LABS", "status": "ELITE" }`}
                    </div>
                </div>
             </div>
             <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl transform -rotate-3 -z-10 opacity-50 scale-105 blur-sm"></div>
          </div>
        </div>
      </div>

      {/* --- SERVICES GRID --- */}
      <div id="work" className="bg-slate-900 text-white py-24">
         <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-3xl font-black mb-16 text-center">OUR EXPERTISE</h2>
            
            <div className="grid md:grid-cols-3 gap-8">
                {[
                    { icon: <PenTool/>, title: "Brand Identity", desc: "Forging logos that burn into the collective consciousness." },
                    { icon: <Globe/>, title: "Digital Architecture", desc: "Websites that function as high-performance machines." },
                    { icon: <Layers/>, title: "System Design", desc: "Scalable design systems for Fortune 500 ecosystems." },
                ].map((item, i) => (
                    <div key={i} className="bg-white/5 p-8 rounded-2xl border border-white/10 hover:bg-white/10 transition group cursor-default">
                        <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition text-white">
                            {item.icon}
                        </div>
                        <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                        <p className="text-slate-400 leading-relaxed">{item.desc}</p>
                    </div>
                ))}
            </div>
         </div>
      </div>

      {/* --- FOOTER --- */}
      <footer className="bg-slate-50 border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3 font-black text-slate-900">
                <img src="/brand/xplabslogo.svg" alt="XP Labs" className="h-5 w-auto" />
                XP Labs
            </div>
            <div className="text-slate-400 text-sm">
                © 2024 XP Labs Design Group. All rights reserved.
            </div>
            <Link to="/login" className="text-xs font-bold text-indigo-600 hover:text-indigo-800">
                INTERNAL SYSTEMS
            </Link>
        </div>
      </footer>

      {/* ======================================================= */}
      {/* PROJECT INTAKE MODAL                    */}
      {/* ======================================================= */}
      
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity"
                onClick={() => setIsModalOpen(false)}
            ></div>

            {/* Modal Content */}
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden animate-in fade-in zoom-in duration-300">
                
                {/* Close Button */}
                <button 
                    onClick={() => setIsModalOpen(false)}
                    className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition"
                >
                    <X size={20} className="text-slate-500" />
                </button>

                {formState === "success" ? (
                    // SUCCESS STATE
                    <div className="p-12 text-center flex flex-col items-center">
                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                            <CheckCircle size={40} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">TRANSMISSION RECEIVED</h2>
                        <p className="text-slate-500 mb-6">
                            Your brief has been uploaded to our secure servers. Our intake algorithm is currently analyzing your request.
                        </p>
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm text-slate-600 mb-6">
                            Reference ID: <span className="font-mono font-bold text-slate-900">#REQ-{Math.floor(Math.random() * 9999)}</span>
                        </div>
                        <button 
                            onClick={() => setIsModalOpen(false)}
                            className="bg-slate-900 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-600 transition"
                        >
                            Close Transmission
                        </button>
                    </div>
                ) : (
                    // FORM STATE
                    <div className="flex flex-col h-full max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 bg-slate-50">
                            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                                <PenTool size={20} className="text-indigo-600" /> START A PROJECT
                            </h2>
                            <p className="text-sm text-slate-500 mt-1">Please provide initial reconnaissance data.</p>
                        </div>
                        
                        <div className="p-6 overflow-y-auto">
                            <form id="projectForm" onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Company / Organization</label>
                                    <input required type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-medium" placeholder="e.g. Wayne Enterprises" />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contact Name</label>
                                        <input required type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="First Last" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                                        <input required type="email" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="name@company.com" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Type</label>
                                    <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                                        <option>Brand Identity Overhaul</option>
                                        <option>Web & Digital Experience</option>
                                        <option>Product Design / UX</option>
                                        <option>Video Game UI</option>
                                        <option>Other / Classified</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Est. Budget Range</label>
                                    <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm">
                                        <option>$10,000 - $25,000</option>
                                        <option>$25,000 - $50,000</option>
                                        <option>$50,000 - $100,000</option>
                                        <option>$100,000+</option>
                                        <option>Unlimited / Government Grant</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">The Objective</label>
                                    <textarea required rows="3" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Tell us what you want to build..."></textarea>
                                </div>
                                
                                <div className="flex items-start gap-3 p-3 bg-indigo-50 rounded-lg">
                                    <input type="checkbox" required id="nda" className="mt-1 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                                    <label htmlFor="nda" className="text-xs text-indigo-900 font-medium cursor-pointer leading-tight">
                                        I acknowledge that all submitted materials are subject to the XP Labs Non-Disclosure Agreement (NDA) and Intellectual Property protocols.
                                    </label>
                                </div>
                            </form>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-white">
                            <button 
                                type="submit" 
                                form="projectForm"
                                disabled={formState === "submitting"}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition disabled:opacity-70"
                            >
                                {formState === "submitting" ? (
                                    <><Loader2 className="animate-spin" /> Encrypting & Sending...</>
                                ) : (
                                    <><Send size={18} /> Submit Brief</>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}

    </div>
  );
}
