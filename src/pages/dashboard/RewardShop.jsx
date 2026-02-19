import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/firebase";
import { 
    doc, onSnapshot, updateDoc, arrayUnion, 
    increment, collection, addDoc, serverTimestamp, Timestamp, getDoc, setDoc
} from "firebase/firestore"; 
import { 
    ShoppingBag, Search, Filter, Lock, 
    Headphones, Zap, Crown, Sun, UserCheck, Trash2, Mic, 
    Smartphone, FileSignature, Monitor, Ghost,
    DollarSign, Clock, MapPin, Coffee, LifeBuoy, 
    Briefcase, PenTool, Trophy, AlertTriangle, TrendingDown,
    Music, Percent, X
} from "lucide-react";
import Navbar from "../../components/Navbar"; 
import { useTheme } from "../../context/ThemeContext";

// 1. THE ICON MAP
const ICON_MAP = {
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
    "user-check": <UserCheck size={24} className="text-green-500" />,
    "percent": <Percent size={24} className="text-purple-500" />,
    "dollar-sign": <DollarSign size={24} className="text-emerald-500" />
};

const EGG_BADGE_ID = "egg_hunter_2";
const EGG_BADGE_TITLE = "Egg Hunter II";
const EGG_BADGE_DESCRIPTION = "Found the hidden shop egg.";
const EGG_REWARD_CURRENCY = 1000;
const EGG_RIDDLE_ANSWER = "abracadabra";

export default function RewardShop() {
  const { user } = useAuth();
  const [userData, setUserData] = useState(null);
  const [shopItems, setShopItems] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);
  const [, setEggClicks] = useState(0);
  const [showEggModal, setShowEggModal] = useState(false);
  const [eggAnswer, setEggAnswer] = useState("");
  const [eggError, setEggError] = useState("");
  const [eggSolved, setEggSolved] = useState(false);
  const [eggClaiming, setEggClaiming] = useState(false);
  const eggClickTimeout = useRef(null);
  const { theme } = useTheme();
  const labels = theme.labels;

  const shopItemById = useMemo(() => {
    const map = {};
    shopItems.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, [shopItems]);

  const resolveExpiryDate = (rawExpiry) => {
    if (!rawExpiry) return null;
    return rawExpiry?.toDate ? rawExpiry.toDate() : new Date(rawExpiry);
  };

  const sparkleSeeds = useMemo(() => (
    Array.from({ length: 14 }, (_, index) => ({
      id: index,
      left: `${8 + (index * 13) % 85}%`,
      top: `${10 + (index * 17) % 75}%`,
      size: `${10 + (index % 4) * 4}px`,
      delay: `${(index % 6) * 0.4}s`,
      duration: `${2.8 + (index % 5) * 0.6}s`,
      symbol: index % 2 === 0 ? "*" : "+"
    }))
  ), []);

  // --- LISTENERS ---
  useEffect(() => {
    if (!user) return;

    // 1. User Data & Inventory
    const unsubUser = onSnapshot(
        doc(db, "users", user.uid),
        (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setUserData(data);
                setInventory(data.inventory || []); // Ensure array exists
            }
        },
        (error) => {
            console.error("RewardShop user listener failed:", error);
        }
    );

    // 2. Shop Items (Real-time to catch the sale immediately)
    const unsubShop = onSnapshot(
        collection(db, "shop_items"),
        (snap) => {
            const items = snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    // SAFETY: Force these to be numbers immediately
                    // If price is missing or text, it becomes 0.
                    price: Number(data.price) || 0,
                    stock: Number(data.stock) || 0,
                    original_price: data.original_price ? Number(data.original_price) : null
                };
            });

            // Sort: Cheapest first, but out-of-stock last
            items.sort((a, b) => {
                // Move out-of-stock items to the bottom
                if (a.stock === 0 && b.stock > 0) return 1;
                if (b.stock === 0 && a.stock > 0) return -1;
                
                // Standard price sort
                return a.price - b.price;
            });

            setShopItems(items);
            setLoading(false);
        },
        (error) => {
            console.error("RewardShop items listener failed:", error);
            setLoading(false);
        }
    );

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

      const isXpBoost = item.effectType === "xp_boost";
      const isCashBoost = item.effectType === "currency_boost";
      const boostPercent = isXpBoost ? Number(item.xpBoostPercent) || 10 : Number(item.currencyBoostPercent) || 10;
      const boostDays = isXpBoost ? Number(item.xpBoostDays) || 14 : Number(item.currencyBoostDays) || 14;
      const currentExpiry = resolveExpiryDate(
          isXpBoost ? userData?.xpBoostExpiresAt : userData?.currencyBoostExpiresAt
      );
      const now = new Date();
      const hasActiveBoost = currentExpiry && currentExpiry > now;

      // No stacking: block purchase if boost already active
      if ((isXpBoost || isCashBoost) && hasActiveBoost) {
          alert(`${isCashBoost ? `${labels.currency} Boost` : "XP Boost"} already active until ${currentExpiry.toLocaleDateString()}.`);
          return;
      }

      const nextBoostExpiry = (isXpBoost || isCashBoost)
          ? new Date(now.getTime() + boostDays * 24 * 60 * 60 * 1000)
          : null;

      if(!confirm(`Purchase "${item.title}" for $${item.price}?`)) return;

      setPurchasing(item.id);

      try {
          // 1. Deduct Money & Add to Inventory
          const userRef = doc(db, "users", user.uid);
          const updates = {
              currency: increment(-item.price),
              inventory: arrayUnion({
                  itemId: item.id,
                  name: item.title,
                  purchaseDate: new Date().toISOString(),
                  redeemed: false,
                  effectType: item.effectType || "none",
                  xpBoostPercent: item.xpBoostPercent || null,
                  xpBoostDays: item.xpBoostDays || null,
                  currencyBoostPercent: item.currencyBoostPercent || null,
                  currencyBoostDays: item.currencyBoostDays || null
              })
          };

          if (isXpBoost && nextBoostExpiry) {
              updates.xpBoostExpiresAt = Timestamp.fromDate(nextBoostExpiry);
              updates.xpBoostPercent = boostPercent;
              updates.xpBoostNotifiedSoon = false;
              updates.xpBoostNotifiedExpired = false;
          }
          if (isCashBoost && nextBoostExpiry) {
              updates.currencyBoostExpiresAt = Timestamp.fromDate(nextBoostExpiry);
              updates.currencyBoostPercent = boostPercent;
              updates.currencyBoostNotifiedSoon = false;
              updates.currencyBoostNotifiedExpired = false;
          }

          await updateDoc(userRef, updates);

          // 2. Decrement Stock
          const itemRef = doc(db, "shop_items", item.id);
          await updateDoc(itemRef, {
              stock: increment(-1)
          });

          // 3. Add Alert
          const boostMessage = (isXpBoost || isCashBoost)
              ? ` Boost active until ${nextBoostExpiry.toLocaleDateString()}.`
              : "";
          await addDoc(collection(db, "users", user.uid, "alerts"), {
              type: "success",
              message: `Purchased ${item.title}! Check your inventory.${boostMessage}`,
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

  const hasEggBadge = !!userData?.badges?.[EGG_BADGE_ID];

  const handleEggTrigger = () => {
      if (hasEggBadge) return;
      setEggError("");
      setEggAnswer("");
      setEggSolved(false);
      setEggClicks((prev) => {
          const next = prev + 1;
          if (next >= 5) {
              setShowEggModal(true);
              return 0;
          }
          return next;
      });
      if (eggClickTimeout.current) {
          clearTimeout(eggClickTimeout.current);
      }
      eggClickTimeout.current = setTimeout(() => setEggClicks(0), 1200);
  };

  const handleEggUnlock = () => {
      const normalized = eggAnswer.trim().toLowerCase();
      if (normalized === EGG_RIDDLE_ANSWER) {
          setEggSolved(true);
          setEggError("");
          return;
      }
      setEggSolved(false);
      setEggError("The spell fizzles. Try again.");
  };

  const handleClaimEggReward = async () => {
      if (eggClaiming || hasEggBadge) return;
      setEggClaiming(true);
      try {
          const badgeRef = doc(db, "badges", EGG_BADGE_ID);
          const badgeSnap = await getDoc(badgeRef);
          if (!badgeSnap.exists()) {
              await setDoc(badgeRef, {
                  title: EGG_BADGE_TITLE,
                  description: EGG_BADGE_DESCRIPTION,
                  xpReward: 0,
                  currencyReward: EGG_REWARD_CURRENCY,
                  iconName: "trophy",
                  createdAt: serverTimestamp()
              });
          }

          await updateDoc(doc(db, "users", user.uid), {
              [`badges.${EGG_BADGE_ID}`]: {
                  earnedAt: new Date().toISOString(),
                  title: EGG_BADGE_TITLE
              },
              currency: increment(EGG_REWARD_CURRENCY)
          });

          await addDoc(collection(db, "users", user.uid, "alerts"), {
              type: "success",
              message: `Egg secured! +$${EGG_REWARD_CURRENCY} and "${EGG_BADGE_TITLE}" unlocked.`,
              read: false,
              createdAt: serverTimestamp()
          });

          setShowEggModal(false);
          setEggSolved(false);
          setEggAnswer("");
          setEggError("");
      } catch (error) {
          console.error("Egg reward failed:", error);
          setEggError("Reward drop failed. Try again.");
      } finally {
          setEggClaiming(false);
      }
  };

  useEffect(() => {
      return () => {
          if (eggClickTimeout.current) {
              clearTimeout(eggClickTimeout.current);
          }
      };
  }, []);

  if (loading) return <div className="p-10 text-center text-slate-400">Loading {labels.shop}...</div>;

  // Check if a sale is active (if any item has an original_price)
  const isMarketCrash = shopItems.some(i => i.original_price);

  return (
    <div className="min-h-screen theme-bg pb-20">
      <style>{`
        @keyframes shop-egg-sparkle {
          0%, 100% { opacity: 0; transform: translateY(6px) scale(0.6); }
          40% { opacity: 0.95; transform: translateY(-6px) scale(1); }
          70% { opacity: 0.4; transform: translateY(-12px) scale(0.8); }
        }
        .shop-egg-sparkle {
          animation-name: shop-egg-sparkle;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
        }
      `}</style>
      <Navbar />

      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-3xl font-black theme-text flex items-center gap-2" onClick={handleEggTrigger}>
                    <ShoppingBag className="text-indigo-600" /> {labels.shop}
                </h1>
                <p className="theme-muted font-medium">Spend your hard-earned {labels.currency.toLowerCase()} on real life rewards.</p>
            </div>
            <div className="theme-surface px-4 py-2 rounded-xl shadow-sm border theme-border flex items-center gap-2">
                <div className="bg-emerald-100 p-2 rounded-full">
                    <DollarSign size={20} className="text-emerald-600" />
                </div>
                <div>
                    <p className="text-xs theme-muted font-bold uppercase">{labels.currency} Balance</p>
                    <p className="text-xl font-black theme-text">${userData?.currency || 0}</p>
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
                const isXpBoost = item.effectType === "xp_boost";
                const isCashBoost = item.effectType === "currency_boost";
                const currentExpiry = resolveExpiryDate(
                    isXpBoost ? userData?.xpBoostExpiresAt : userData?.currencyBoostExpiresAt
                );
                const hasActiveBoost = currentExpiry && currentExpiry > new Date();
                const boostBlocked = (isXpBoost || isCashBoost) && hasActiveBoost;
                // Check if this specific item is on sale
                const isOnSale = item.original_price && item.original_price > item.price;

                return (
                    <div 
                        key={item.id} 
                        className={`relative group theme-surface rounded-xl p-5 border theme-border shadow-sm transition-all hover:shadow-md flex flex-col justify-between h-full
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
                            
                            <h3 className="font-bold theme-text text-lg leading-tight mb-1">{item.title}</h3>
                            <p className="text-sm theme-muted leading-snug">{item.desc}</p>
                            {item.effectType === "xp_boost" && (
                                <p className="text-xs font-bold text-purple-600 mt-2">
                                    +{Number(item.xpBoostPercent || 10)}% XP for {Number(item.xpBoostDays || 14)} days
                                </p>
                            )}
                            {item.effectType === "currency_boost" && (
                                <p className="text-xs font-bold text-emerald-600 mt-2">
                                    +{Number(item.currencyBoostPercent || 10)}% {labels.currency} for {Number(item.currencyBoostDays || 14)} days
                                </p>
                            )}
                            
                            {/* STOCK COUNTER */}
                        {!outOfStock && (
                            <p className="text-xs font-bold text-slate-400 mt-2 flex items-center gap-1">
                                <ShoppingBag size={12}/> {item.stock} Remaining
                            </p>
                        )}
                        {boostBlocked && (
                            <p className="text-xs font-bold text-amber-600 mt-2">
                                Boost active until {currentExpiry.toLocaleDateString()}
                            </p>
                        )}
                    </div>

                    {/* PRICE BUTTON */}
                    <button
                        onClick={() => purchaseItem(item)}
                        disabled={!canAfford || outOfStock || purchasing === item.id || boostBlocked}
                        className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition active:scale-95
                                ${outOfStock 
                                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                    : boostBlocked
                                        ? "bg-amber-100 text-amber-700 cursor-not-allowed"
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
                        ) : boostBlocked ? (
                            <span>Boost Active</span>
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
          <h2 className="text-xl font-bold theme-text mb-6 flex items-center gap-2">
              <Briefcase className="text-slate-400" /> Your Inventory
          </h2>
          {inventory.length === 0 ? (
                <div className="text-center py-10 theme-card rounded-xl border border-dashed theme-border theme-muted">
                    <Ghost size={48} className="mx-auto mb-2 opacity-20" />
                    You haven't bought anything yet. Go shopping!
                </div>
          ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {inventory.map((item, index) => (
                      (() => {
                          const shopItem = shopItemById[item.itemId];
                          const explicitType = item.effectType && item.effectType !== "none"
                              ? item.effectType
                              : shopItem?.effectType && shopItem.effectType !== "none"
                                  ? shopItem.effectType
                                  : null;
                          const hasXpBoost = (item.xpBoostPercent ?? shopItem?.xpBoostPercent) != null;
                          const hasCashBoost = (item.currencyBoostPercent ?? shopItem?.currencyBoostPercent) != null;
                          const inferredType = explicitType || (hasXpBoost ? "xp_boost" : hasCashBoost ? "currency_boost" : "none");
                          const isXpBoost = inferredType === "xp_boost";
                          const isCashBoost = inferredType === "currency_boost";
                          const boostExpiry = resolveExpiryDate(
                              isXpBoost ? userData?.xpBoostExpiresAt : userData?.currencyBoostExpiresAt
                          );
                          const boostActive = boostExpiry && boostExpiry > new Date();
                          const isBoostItem = isXpBoost || isCashBoost;
                          const statusLabel = isBoostItem
                              ? (boostActive ? "ACTIVE" : "EXPIRED")
                              : "UNUSED";
                          const statusClasses = isBoostItem
                              ? (boostActive
                                  ? isCashBoost
                                      ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                      : "bg-purple-100 text-purple-700 border border-purple-200"
                                  : "bg-slate-100 text-slate-500 border border-slate-200")
                              : "bg-emerald-50 text-emerald-600 border border-emerald-100";
                          return (
                    <div key={index} className="theme-surface p-4 rounded-xl border theme-border flex items-center justify-between shadow-sm">
                        <div>
                            <span className="font-bold theme-text block text-sm">{item.name}</span>
                            <span className="text-[10px] font-bold theme-muted uppercase">
                                {new Date(item.purchaseDate).toLocaleDateString()}
                            </span>
                        </div>
                        <span className={`text-[10px] px-2 py-1 rounded font-bold ${statusClasses}`}>
                            {statusLabel}
                        </span>
                    </div>
                          );
                      })()
                  ))}
              </div>
          )}
      </div>

      {showEggModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
                <div className="absolute inset-0 pointer-events-none">
                    {sparkleSeeds.map((sparkle) => (
                        <span
                            key={sparkle.id}
                            className="shop-egg-sparkle absolute text-amber-300"
                            style={{
                                left: sparkle.left,
                                top: sparkle.top,
                                fontSize: sparkle.size,
                                animationDelay: sparkle.delay,
                                animationDuration: sparkle.duration
                            }}
                        >
                            {sparkle.symbol}
                        </span>
                    ))}
                </div>
                <div className="relative z-10">
                    <div className="bg-slate-100/90 p-4 flex items-center justify-between border-b border-slate-200">
                        <h3 className="font-black text-slate-700 flex items-center gap-2">
                            <Lock size={18} className="text-indigo-600" />
                            Arcane Checkout
                        </h3>
                        <button
                            onClick={() => {
                                setShowEggModal(false);
                                setEggSolved(false);
                                setEggAnswer("");
                                setEggError("");
                            }}
                            className="text-slate-400 hover:text-slate-600 transition"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        {hasEggBadge ? (
                            <div className="text-sm text-slate-600">
                                You already claimed this drop. Keep hunting for the next egg.
                            </div>
                        ) : (
                            <>
                                <p className="text-sm text-slate-600">
                                    Riddle of the arcane aisle: I begin every spell, I rhyme with "cadaver," and
                                    I never end unless you say me twice. What am I?
                                </p>
                                <div className="flex items-center gap-2">
                                    <input
                                        value={eggAnswer}
                                        onChange={(e) => setEggAnswer(e.target.value)}
                                        placeholder="Whisper the word"
                                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleEggUnlock}
                                        className="px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-indigo-600 transition"
                                    >
                                        Cast
                                    </button>
                                </div>
                                {eggError && (
                                    <p className="text-xs font-bold text-red-500">{eggError}</p>
                                )}
                                {eggSolved && (
                                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                                        The shopkeeper nods. Your glittering prize awaits.
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={handleClaimEggReward}
                                    disabled={!eggSolved || eggClaiming}
                                    className="w-full py-2 rounded-lg font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                    {eggClaiming ? "Summoning Reward..." : `Claim $${EGG_REWARD_CURRENCY} + ${EGG_BADGE_TITLE}`}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}
      </div>
    </div>
  );
}
