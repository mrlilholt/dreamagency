import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/firebase";
import { 
    doc, onSnapshot, updateDoc, arrayUnion, 
    increment, addDoc, collection, serverTimestamp 
} from "firebase/firestore"; 
import { 
    ShoppingBag, Search, Filter, Lock, 
    Headphones, Zap, Crown, Sun, UserCheck, Trash2, Mic, 
    Smartphone, FileSignature, Monitor, Ghost,
    DollarSign, Clock, MapPin, Coffee, LifeBuoy, 
    Briefcase, PenTool, Trophy, AlertTriangle, TrendingDown,
    Music // <--- ADDED THIS MISSING IMPORT
} from "lucide-react";
import Navbar from "../../components/Navbar"; 

// --- YOUR CUSTOM INVENTORY ---
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
        price: 5000, 
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
        id: "debug_help_2", // Unique ID
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
        id: "creative_override_2",
        title: "Creative Override (Major)",
        desc: "Veto one specific constraint in a project brief (e.g. 'I don't want to use Blue, I want to use Red').",
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
        id: "endorsement_2", 
        title: "LinkedIn Endorsement (Premium)",
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

export default function RewardShop() {
  const { user, userData } = useAuth();
  
  // State
  const [balance, setBalance] = useState(0);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [marketStatus, setMarketStatus] = useState({ saleActive: false });

  // 1. LISTEN TO USER DATA
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

  // 2. LISTEN TO MARKET STATUS (Global Sale)
  useEffect(() => {
    const unsubMarket = onSnapshot(doc(db, "system", "market"), (docSnap) => {
        if (docSnap.exists()) {
            setMarketStatus(docSnap.data());
        }
    });
    return () => unsubMarket();
  }, []);

  // 3. BUY FUNCTION
  const buyItem = async (item) => {
    // A. Calculate Dynamic Price
    const currentPrice = marketStatus.saleActive 
        ? Math.floor(item.price * 0.5) 
        : item.price;

    if (balance < currentPrice) return alert("Insufficient funds!");
    if (!confirm(`Buy ${item.title} for $${currentPrice}?`)) return;

    setLoading(true);
    try {
        const userRef = doc(db, "users", user.uid);
        
        // B. Update User: Deduct Money & Add to Inventory
        await updateDoc(userRef, {
            currency: increment(-currentPrice),
            inventory: arrayUnion({
                id: item.id,
                name: item.title,
                purchaseDate: new Date().toISOString(),
                status: 'unused',
                originalPrice: item.price,
                paidPrice: currentPrice
            })
        });

        // C. Create Receipt for Admin to see in "Active Jobs"
        if (item.id !== 'market_crash') {
            await addDoc(collection(db, "active_jobs"), {
                contract_title: `PURCHASE: ${item.title}`,
                student_id: user.uid,
                student_name: userData.name || user.email,
                status: "pending_fulfillment", 
                submittedAt: serverTimestamp(),
                type: "shop_purchase",
                itemId: item.id
            });
        }

        // D. Special Trigger for "Market Crash" item
        if (item.id === 'market_crash') {
             await updateDoc(doc(db, "system", "market"), {
                saleActive: true,
                triggeredBy: userData.name
            });
            alert("MARKET CRASHED! Prices dropped 50%.");
        } else {
            alert("Purchase Successful!");
        }

    } catch (error) {
        console.error(error);
        alert("Transaction Failed");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Navbar /> 

      <div className="max-w-7xl mx-auto p-8">
        
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

        {/* --- MARKET CRASH BANNER --- */}
        {marketStatus.saleActive && (
          <div className="bg-red-600 text-white p-6 rounded-2xl shadow-xl shadow-red-500/30 mb-10 flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-full">
                      <TrendingDown size={32} className="text-white" />
                  </div>
                  <div>
                      <h2 className="text-2xl font-black uppercase tracking-wider">Market Crash Detected</h2>
                      <p className="text-red-100 font-bold">ALL PRICES SLASHED BY 50% FOR A LIMITED TIME.</p>
                  </div>
              </div>
              <div className="hidden md:block text-4xl font-black opacity-30 rotate-12">
                  -50%
              </div>
          </div>
        )}

        {/* SHOP GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {SHOP_ITEMS.map((item) => {
                // Logic per card
                const isSale = marketStatus.saleActive;
                const finalPrice = isSale ? Math.floor(item.price * 0.5) : item.price;
                const canAfford = balance >= finalPrice;

                return (
                    <div key={item.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col hover:shadow-md transition relative overflow-hidden">
                        
                        {/* SALE BADGE */}
                        {isSale && (
                            <div className="absolute top-0 right-0 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl z-10">
                                -50% SALE
                            </div>
                        )}

                        <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 mb-4">
                            {item.icon}
                        </div>
                        <h3 className="font-bold text-lg text-slate-900 mb-2">{item.title}</h3>
                        <p className="text-sm text-slate-500 mb-6 flex-1">{item.desc}</p>
                        
                        {/* Price Display */}
                        <div className="mb-4">
                             {isSale && (
                                <span className="block text-xs text-slate-400 line-through decoration-red-500 decoration-2 font-bold">
                                    ${item.price}
                                </span>
                            )}
                        </div>

                        <button 
                            onClick={() => buyItem(item)}
                            disabled={loading || !canAfford}
                            className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition ${
                                canAfford 
                                ? (isSale ? "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-200" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200")
                                : "bg-slate-100 text-slate-400 cursor-not-allowed"
                            }`}
                        >
                            <DollarSign size={16} /> {finalPrice}
                        </button>
                    </div>
                );
            })}
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
                            <div>
                                <span className="font-bold text-slate-700 block">{item.name}</span>
                                <span className="text-xs text-slate-400">{new Date(item.purchaseDate).toLocaleDateString()}</span>
                            </div>
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