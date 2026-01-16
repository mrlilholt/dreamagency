import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/firebase";
import { doc, onSnapshot, updateDoc, arrayUnion, increment } from "firebase/firestore"; 
import { ShoppingBag, DollarSign, Clock, Music, Coffee, Shield } from "lucide-react";
// 1. Import the Navbar
import Navbar from "../../components/Navbar"; 

const SHOP_ITEMS = [
    { id: 'late_pass', name: 'Late Assignment Pass', cost: 150, icon: <Clock size={24}/>, desc: 'Submit one assignment up to 24 hours late with no penalty.' },
    { id: 'music_pass', name: 'Headphones Pass', cost: 50, icon: <Music size={24}/>, desc: 'Permission to listen to music during independent work time for one day.' },
    { id: 'seat_swap', name: 'Seat Swap', cost: 300, icon: <Coffee size={24}/>, desc: 'Swap seats with a willing peer for one week.' },
    { id: 'resubmit', name: 'Re-Submission Token', cost: 500, icon: <Shield size={24}/>, desc: 'Resubmit a graded project for a higher score cap.' },
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