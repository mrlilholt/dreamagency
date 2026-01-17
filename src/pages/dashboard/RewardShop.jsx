import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/firebase";
import { doc, onSnapshot, updateDoc, arrayUnion, increment } from "firebase/firestore"; 
import { ShoppingBag, DollarSign, Clock, Music, Coffee, Shield } from "lucide-react";
// 1. Import the Navbar
import Navbar from "../../components/Navbar"; 
import { 
     Search, Filter, Lock, 
    Headphones, Zap, Crown, Sun, UserCheck, Trash2, Mic, 
    Smartphone, FileSignature, Monitor, Ghost
} from "lucide-react";
const SHOP_ITEMS = [
    {
        id: "debug_help",
        title: "Senior Dev Consultation",
        desc: "The Director (Teacher) will personally sit at your desk and debug your code for 5 minutes. No judgement.",
        price: 800,
        icon: <LifeBuoy size={24} className="text-red-500" />,
        stock: 5
    },
    {
        id: "hall_pass",
        title: "Field Reconnaissance",
        desc: "An extended 10-minute break to 'scout the perimeter' (Walk, fountain, bathroom). No questions asked.",
        price: 250,
        icon: <MapPin size={24} className="text-indigo-500" />,
        stock: 20
    },
    {
        id: "endorsement",
        title: "LinkedIn Endorsement",
        desc: "The Director will write a real skill endorsement or recommendation on your LinkedIn profile (or a college letter blurb).",
        price: 5000, // Make this EXPENSIVE. It's real value.
        icon: <Briefcase size={24} className="text-blue-600" />,
        stock: 3
    },
    {
        id: "creative_override",
        title: "Creative Director Override",
        desc: "Veto one constraint in a project brief. (e.g., Use a different color palette, font, or layout than the client asked for).",
        price: 1500,
        icon: <PenTool size={24} className="text-pink-500" />,
        stock: 5
    },
    {
        id: "early_release",
        title: "Early Clock-Out",
        desc: "Permission to pack up and leave class 3 minutes before the bell.",
        price: 400,
        icon: <Clock size={24} className="text-amber-500" />,
        stock: 10
    },
    {
        id: "title_change",
        title: "Promotion (Title Change)",
        desc: "Change your role title on the dashboard from 'Junior Associate' to a custom title (e.g., 'Vice President of CSS') for one week.",
        price: 1000,
        icon: <Trophy size={24} className="text-yellow-500" />,
        stock: 1
    },
    // --- TIER 1: CONVENIENCE (Cheap) ---
    {
        id: "admin_exemption",
        title: "Admin Exemption",
        desc: "Skip the 'Bell Ringer' or 'Exit Ticket' for one day. Mark it as 'Delegated'.",
        price: 150,
        icon: <FileSignature size={24} className="text-slate-400" />,
        stock: 50
    },
    {
        id: "hydration_permit",
        title: "Coffee Run",
        desc: "Permission to go to the cafeteria/vending machine for 5 minutes during work time.",
        price: 200,
        icon: <Coffee size={24} className="text-amber-700" />,
        stock: 20
    },
    {
        id: "dark_mode",
        title: "Studio Dark Mode",
        desc: "The buyer can demand the classroom lights be turned off (or dimmed) for the entire period.",
        price: 250,
        icon: <Sun size={24} className="text-slate-900" />,
        stock: 5
    },
    {
        id: "undercover",
        title: "Undercover Agent",
        desc: "Permission to wear a hat, hood, or sunglasses inside the 'office' for one day.",
        price: 300,
        icon: <Ghost size={24} className="text-purple-500" />,
        stock: 20
    },

    // --- TIER 2: POWER & INFLUENCE (Mid-Range) ---
    {
        id: "aux_cord",
        title: "DJ Control",
        desc: "You control the classroom speaker for 20 minutes. Must remain work-appropriate.",
        price: 500,
        icon: <Music size={24} className="text-pink-500" />,
        stock: 10
    },
    {
        id: "consultant_badge",
        title: "Roaming Consultant",
        desc: "Permission to walk around and 'consult' (talk) with other teams during independent work time.",
        price: 600,
        icon: <UserCheck size={24} className="text-indigo-500" />,
        stock: 10
    },
    {
        id: "tech_priority",
        title: "IT Priority Ticket",
        desc: "Skip the line when asking for help. The Director (Teacher) comes to you next, immediately.",
        price: 750,
        icon: <Zap size={24} className="text-yellow-500" />,
        stock: 15
    },
    {
        id: "debug_help",
        title: "Senior Dev Assist",
        desc: "The Director will personally debug your code or fix your design layout for 5 minutes.",
        price: 800,
        icon: <LifeBuoy size={24} className="text-red-500" />,
        stock: 5
    },

    // --- TIER 3: EXECUTIVE STATUS (Expensive) ---
    {
        id: "the_throne",
        title: "The CEO Chair",
        desc: "Swap chairs with the Teacher for the entire class period. Enjoy the lumbar support.",
        price: 1200,
        icon: <Crown size={24} className="text-yellow-600" />,
        stock: 1
    },
    {
        id: "press_release",
        title: "Positive Press Release",
        desc: "The Director sends a positive email home to your stakeholders (parents) bragging about a specific win.",
        price: 1500,
        icon: <Mic size={24} className="text-blue-500" />,
        stock: 5
    },
    {
        id: "creative_override",
        title: "Creative Override",
        desc: "Veto one specific constraint in a project brief (e.g. \"I don't want to use Blue, I want to use Red\").",
        price: 1800,
        icon: <PenTool size={24} className="text-emerald-500" />,
        stock: 5
    },
    {
        id: "dual_monitor",
        title: "Hardware Upgrade",
        desc: "First dibs on the 'best computer' or permission to use the teacher's second monitor (if applicable).",
        price: 2000,
        icon: <Monitor size={24} className="text-cyan-500" />,
        stock: 2
    },

    // --- TIER 4: LEGENDARY (The Grinds) ---
    {
        id: "record_expungement",
        title: "Record Expungement",
        desc: "Drop your lowest quiz score or minor assignment grade from the gradebook.",
        price: 4000,
        icon: <Trash2 size={24} className="text-red-600" />,
        stock: 3
    },
    {
        id: "endorsement",
        title: "LinkedIn Endorsement",
        desc: "The Director writes a real, professional skill recommendation on your LinkedIn profile.",
        price: 5000,
        icon: <Briefcase size={24} className="text-blue-700" />,
        stock: 3
    },
    {
        id: "contract_kill",
        title: "Contract Cancellation",
        desc: "You are excused from ONE minor assignment entirely. You get full credit/pay.",
        price: 8000,
        icon: <Lock size={24} className="text-slate-900" />,
        stock: 1
    },
    {
        id: "market_crash",
        title: "Market Manipulation",
        desc: "Trigger a 'Flash Sale' where all shop items are 50% off for the rest of the class. (Hero of the People).",
        price: 10000,
        icon: <Smartphone size={24} className="text-green-500" />,
        stock: 1
    }
];

export default function RewardsShop() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);

  // Listen to User Data (Balance & Inventory)
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (doc) => {
        if (doc.exists()) {
            setBalance(doc.data().currency || 0);
            setInventory(doc.data().inventory || []);
        }
    });
    return () => unsub();
  }, [user]);

  const buyItem = async (item) => {
    if (balance < item.cost) return alert("Insufficient funds!");
    if (!confirm(`Buy ${item.name} for $${item.cost}?`)) return;

    setLoading(true);
    try {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
            currency: increment(-item.cost),
            inventory: arrayUnion({
                id: item.id,
                name: item.name,
                purchaseDate: new Date().toISOString(),
                status: 'unused'
            })
        });
        alert("Purchase Successful!");
    } catch (error) {
        console.error(error);
        alert("Transaction Failed");
    }
    setLoading(false);
  };

  return (
    // 2. Wrap everything in the layout container
    <div className="min-h-screen bg-slate-50 pb-20">
      <Navbar /> 

      <div className="max-w-6xl mx-auto p-8">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
            <div>
                <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                    <ShoppingBag className="text-indigo-600" size={32}/> Agency Store
                </h1>
                <p className="text-slate-500 mt-2">Exchange your hard-earned earnings for agency perks.</p>
            </div>
            
            {/* Balance Card */}
            <div className="bg-white px-6 py-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                <div className="text-right">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Available Funds</p>
                    <p className="text-2xl font-black text-green-600">${balance}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                    <DollarSign size={24} />
                </div>
            </div>
        </div>

        {/* SHOP GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {SHOP_ITEMS.map((item) => (
                <div key={item.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col hover:shadow-md transition">
                    <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 mb-4">
                        {item.icon}
                    </div>
                    <h3 className="font-bold text-lg text-slate-900 mb-2">{item.name}</h3>
                    <p className="text-sm text-slate-500 mb-6 flex-1">{item.desc}</p>
                    
                    <button 
                        onClick={() => buyItem(item)}
                        disabled={loading || balance < item.cost}
                        className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition ${
                            balance >= item.cost 
                            ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200" 
                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                        }`}
                    >
                        <DollarSign size={16} /> {item.cost}
                    </button>
                </div>
            ))}
        </div>

        {/* INVENTORY SECTION */}
        <div className="border-t border-slate-200 pt-8">
            <h2 className="text-xl font-bold text-slate-800 mb-6">Your Inventory</h2>
            {inventory.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                    You haven't bought anything yet. Go shopping!
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {inventory.map((item, index) => (
                        <div key={index} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                            <span className="font-bold text-slate-700">{item.name}</span>
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold">UNUSED</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}