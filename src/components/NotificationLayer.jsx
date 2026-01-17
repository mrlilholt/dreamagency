import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { BADGES } from "../lib/gameConfig";
import { X, Sparkles } from "lucide-react";
import confetti from "canvas-confetti"; // Optional: npm install canvas-confetti for extra flair

export default function NotificationLayer() {
  const { user } = useAuth();
  const [activeBadge, setActiveBadge] = useState(null);

  useEffect(() => {
    if (!user) return;

    // Listen to the current user's document
    const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
        const userData = docSnap.data();
        if (!userData || !userData.badges) return;

        // Find the first badge marked as 'new'
        const newBadge = userData.badges.find(b => b.new === true);

        if (newBadge) {
            // Match it with our definitions to get Title/Icon
            const badgeDef = BADGES[newBadge.id];
            if (badgeDef) {
                setActiveBadge({ ...badgeDef, ...newBadge });
                // Trigger confetti visual
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 }
                });
            }
        }
    });

    return () => unsub();
  }, [user]);

  const dismissBadge = async () => {
    if (!user || !activeBadge) return;

    try {
        // We need to fetch the current badges, flip 'new' to false, and save back
        // (Ideally we do this via array manipulation, but reading/writing entire array is safer for now)
        // Note: In a real production app, we'd use a transaction here.
        
        // 1. Get current data
        // We rely on the fact that we can't easily update a specific object in a Firestore array without reading it first.
        // For this specific interaction, we will just update the UI immediately to close it
        // and let the backend update handle the persistent 'read' state if you had a 'markAsRead' function.
        
        // SIMPLE VERSION: We read the badges from the activeBadge state? No, need fresh data.
        // Let's just create a function to clean the array.
        
        // Hacky but effective for classroom scale:
        // We can't use arrayRemove/arrayUnion for updating a property inside an object in the array.
        // We have to overwrite the badges array.
        
        // Close modal immediately for UX
        const badgeIdToClear = activeBadge.id;
        setActiveBadge(null); 

        // Update DB
        // We need to assume the `activeBadge` data came from the snapshot we just had.
        // But to be safe, we'll do this inside a transaction or just read-modify-write.
        
        // For simplicity in this codebase, let's assume we can just filter it out locally if we had the full list.
        // Since we don't have the full list in this scope (only the active one), let's just re-fetch in the update logic.
        // OR better yet: passing the full logic to a helper.
        
        // Let's implement the read-modify-write here:
        // (Wait, actually, let's just use the `activeBadge` to hide the modal, 
        // and trigger the DB update. The snapshot listener will fire again, see no 'new' badges, and stay hidden.)
    } catch (err) {
        console.error("Error dismissing badge", err);
    }
  };
  
  // Actually, we need the DB update logic to happen on button click.
  const handleClaim = async () => {
    if(!user || !activeBadge) return;
    
    // Optimistic UI update
    const currentId = activeBadge.id;
    setActiveBadge(null);

    // DB Update
    // We need to get the USER doc, iterate badges, set new: false for this ID
    import("firebase/firestore").then(async ({ getDoc, doc, updateDoc }) => {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        const data = snap.data();
        
        if (data.badges) {
            const updatedBadges = data.badges.map(b => 
                b.id === currentId ? { ...b, new: false } : b
            );
            await updateDoc(userRef, { badges: updatedBadges });
        }
    });
  };

  if (!activeBadge) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center relative shadow-2xl border-4 border-indigo-100 transform animate-in zoom-in-95 duration-300">
            
            {/* GLOW EFFECT */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className={`w-24 h-24 ${activeBadge.color} rounded-full flex items-center justify-center text-5xl shadow-lg ring-8 ring-white`}>
                    {activeBadge.icon}
                </div>
            </div>

            <div className="mt-12 space-y-4">
                <div className="flex items-center justify-center gap-2 text-indigo-600 font-black uppercase tracking-widest text-xs">
                    <Sparkles size={14} /> Achievement Unlocked
                </div>
                
                <h2 className="text-3xl font-black text-slate-900 leading-tight">
                    {activeBadge.title}
                </h2>
                
                <p className="text-slate-500 font-medium">
                    {activeBadge.description}
                </p>

                <div className="pt-4">
                    <button 
                        onClick={handleClaim}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition active:scale-95"
                    >
                        Awesome!
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
}