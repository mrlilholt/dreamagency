import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/firebase";
import { 
    doc, onSnapshot, updateDoc, arrayUnion, 
    increment, collection, addDoc, serverTimestamp 
} from "firebase/firestore"; 
import { 
    ShoppingBag, Search, Filter, Lock, 
    Headphones, Zap, Crown, Sun, UserCheck, Trash2, Mic, 
    Smartphone, FileSignature, Monitor, Ghost,
    DollarSign, Clock, MapPin, Coffee, LifeBuoy, 
    Briefcase, PenTool, Trophy, AlertTriangle, TrendingDown,
    Music, HelpCircle, Percent 
} from "lucide-react";
import Navbar from "../../components/Navbar"; 

// 1. THE ICON MAP
export const ICON_MAP = {
    "life-buoy": <LifeBuoy size={24} className="text-red-500" />,
    "map-pin": <MapPin size={24} className="text-indigo-500" />,
    "music": <Music size={24} className="text-pink-500" />,
    "coffee": <Coffee size={24} className="text-amber-700" />,
    "zap": <Zap size={24} className="text-yellow-500" />,
    "crown": <Crown size={24} className="text-yellow-600" />,
    "ghost": <Ghost size={24} className="text-slate-400" />,
    "headphones": <Headphones size={24} className="text-purple-500" />,
    "briefcase": <Briefcase size={24} className="text-slate-600" />,
    "clock": <Clock size={24} className="text-blue-400" />,
    "trophy": <Trophy size={24} className="text-amber-400" />,
    "pen-tool": <PenTool size={24} className="text-orange-500" />,
    "monitor": <Monitor size={24} className="text-indigo-400" />,
    "smartphone": <Smartphone size={24} className="text-emerald-500" />,
    "file-signature": <FileSignature size={24} className="text-teal-600" />,
    "sun": <Sun size={24} className="text-orange-400" />,
    "mic": <Mic size={24} className="text-sky-500" />,
    "trash-2": <Trash2 size={24} className="text-red-400" />,
    "lock": <Lock size={24} className="text-slate-400" />,
    "user-check": <UserCheck size={24} className="text-green-500" />
};

export default function RewardShop() {
  const { user } = useAuth();
  const [userData, setUserData] = useState(null);
  const [shopItems, setShopItems] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);

  // --- LISTENERS ---
  useEffect(() => {
    if (!user) return;

    // 1. User Data & Inventory
    const unsubUser = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData(data);
            setInventory(data.inventory || []); // Ensure array exists
        }
    });

    // 2. Shop Items (Real-time to catch the sale immediately)
    const unsubShop = onSnapshot(collection(db, "shop_items"), (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort: Cheapest first, but out-of-stock last
        items.sort((a, b) => {
            if (a.stock === 0) return 1;
            if (b.stock === 0) return -1;
            return a.price - b.price;
        });
        setShopItems(items);
        setLoading(false);
    });

    return () => {
        unsubUser();
        unsubShop();
    };
  }, [user]);

  // --- ACTIONS ---
  const purchaseItem = async (item) => {
      if (userData.currency < item.price) {
          alert("Insufficient funds!");
          return;
      }
      if (item.stock <= 0) {
          alert("Out of stock!");
          return;
      }

      if(!confirm(`Purchase "${item.title}" for $${item.price}?`)) return;

      setPurchasing(item.id);

      try {
          // 1. Deduct Money & Add to Inventory
          const userRef = doc(db, "users", user.uid);
          await updateDoc(userRef, {
              currency: increment(-item.price),
              inventory: arrayUnion({
                  itemId: item.id,
                  name: item.title,
                  purchaseDate: new Date().toISOString(),
                  redeemed: false
              })
          });

          // 2. Decrement Stock
          const itemRef = doc(db, "shop_items", item.id);
          await updateDoc(itemRef, {
              stock: increment(-1)
          });

          // 3. Add Alert
          await addDoc(collection(db, "users", user.uid, "alerts"), {
              type: "success",
              message: `Purchased ${item.title}! Check your inventory.`,
              read: false,
              createdAt: serverTimestamp()
          });

      } catch (error) {
          console.error("Purchase failed", error);
          alert("Transaction failed. Try again.");
      } finally {
          setPurchasing(null);
      }
  };

  if (loading) return <div className="p-10 text-center text-slate-400">Loading Market...</div>;

  // Check if a sale is active (if any item has an original_price)
  const isMarketCrash = shopItems.some(i => i.original_price);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Navbar />

      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-3xl font-black text-slate-900 flex items-center gap-2">
                    <ShoppingBag className="text-indigo-600" /> Reward Shop
                </h1>
                <p className="text-slate-500 font-medium">Spend your hard-earned cash on real life rewards.</p>
            </div>
            <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200 flex items-center gap-2">
                <div className="bg-emerald-100 p-2 rounded-full">
                    <DollarSign size={20} className="text-emerald-600" />
                </div>
                <div>
                    <p className="text-xs text-slate-400 font-bold uppercase">Your Balance</p>
                    <p className="text-xl font-black text-slate-900">${userData?.currency || 0}</p>
                </div>
            </div>
        </div>

        {/* MARKET CRASH BANNER - Only shows when admin triggers sale */}
        {isMarketCrash && (
            <div className="bg-red-600 rounded-xl p-4 shadow-lg shadow-red-200 text-white flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                        <TrendingDown size={24} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black uppercase tracking-wider">Market Crash In Progress!</h2>
                        <p className="text-red-100 text-sm font-medium">Prices have been slashed by HQ. Buy now before stability returns.</p>
                    </div>
                </div>
                <div className="hidden md:block">
                    <Percent size={32} className="opacity-50 rotate-12" />
                </div>
            </div>
        )}

        {/* ITEMS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shopItems.map(item => {
                const canAfford = (userData?.currency || 0) >= item.price;
                const outOfStock = item.stock <= 0;
                // Check if this specific item is on sale
                const isOnSale = item.original_price && item.original_price > item.price;

                return (
                    <div 
                        key={item.id} 
                        className={`relative group bg-white rounded-xl p-5 border shadow-sm transition-all hover:shadow-md flex flex-col justify-between h-full
                        ${outOfStock ? "opacity-60 grayscale border-slate-200" : ""}
                        ${isOnSale ? "border-red-200 ring-1 ring-red-100 bg-red-50/10" : "border-slate-200"}
                        `}
                    >
                        {/* SALE BADGE */}
                        {isOnSale && !outOfStock && (
                            <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg shadow-sm z-10">
                                SALE
                            </div>
                        )}

                        <div className="mb-4">
                            <div className="flex justify-between items-start mb-3">
                                <div className={`p-3 rounded-xl ${outOfStock ? "bg-slate-100" : "bg-indigo-50"}`}>
                                    {ICON_MAP[item.iconName] || <Briefcase size={24} className="text-slate-400"/>}
                                </div>
                                {outOfStock && (
                                    <span className="text-[10px] font-bold bg-slate-200 text-slate-500 px-2 py-1 rounded uppercase">
                                        Sold Out
                                    </span>
                                )}
                            </div>
                            
                            <h3 className="font-bold text-slate-900 text-lg leading-tight mb-1">{item.title}</h3>
                            <p className="text-sm text-slate-500 leading-snug">{item.desc}</p>
                            
                            {/* STOCK COUNTER */}
                            {!outOfStock && (
                                <p className="text-xs font-bold text-slate-400 mt-2 flex items-center gap-1">
                                    <ShoppingBag size={12}/> {item.stock} Remaining
                                </p>
                            )}
                        </div>

                        {/* PRICE BUTTON */}
                        <button
                            onClick={() => purchaseItem(item)}
                            disabled={!canAfford || outOfStock || purchasing === item.id}
                            className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition active:scale-95
                                ${outOfStock 
                                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                    : isOnSale 
                                        ? "bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-200" // Red button for sale
                                        : canAfford
                                            ? "bg-slate-900 text-white hover:bg-indigo-600 shadow-md hover:shadow-indigo-200"
                                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                                }
                            `}
                        >
                            {purchasing === item.id ? (
                                <span className="animate-pulse">Processing...</span>
                            ) : isOnSale ? (
                                // SALE PRICE LAYOUT
                                <div className="flex items-center gap-3">
                                    <span className="text-red-200 line-through text-xs font-medium opacity-80">
                                        ${item.original_price}
                                    </span>
                                    <span className="flex items-center gap-1 text-lg">
                                        <DollarSign size={16} strokeWidth={3} /> {item.price}
                                    </span>
                                </div>
                            ) : (
                                // NORMAL PRICE LAYOUT
                                <>
                                    <DollarSign size={16} /> {item.price}
                                </>
                            )}
                        </button>
                    </div>
                );
            })}
        </div>

        {/* INVENTORY SECTION */}
        <div className="border-t border-slate-200 pt-8">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Briefcase className="text-slate-400" /> Your Inventory
            </h2>
            {inventory.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                    <Ghost size={48} className="mx-auto mb-2 opacity-20" />
                    You haven't bought anything yet. Go shopping!
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {inventory.map((item, index) => (
                        <div key={index} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm">
                            <div>
                                <span className="font-bold text-slate-700 block text-sm">{item.name}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">
                                    {new Date(item.purchaseDate).toLocaleDateString()}
                                </span>
                            </div>
                            <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-1 rounded font-bold">
                                UNUSED
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}