import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../lib/firebase";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { Folder, Edit, Trash, ArrowLeft, Plus } from "lucide-react";
import AdminNavbar from "../../components/AdminNavbar";

export default function AllContracts() {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContracts = async () => {
      const snap = await getDocs(collection(db, "contracts"));
      const grouped = {};

      snap.docs.forEach(doc => {
        const data = doc.data();
        const group = data.class_id || "Global / Unassigned"; // Default group
        
        if (!grouped[group]) grouped[group] = [];
        grouped[group].push({ id: doc.id, ...data });
      });

      setContracts(grouped);
      setLoading(false);
    };
    fetchContracts();
  }, []);

  const handleDelete = async (id) => {
    if (!confirm("Are you sure? This will delete the contract forever.")) return;
    await deleteDoc(doc(db, "contracts", id));
    window.location.reload(); // Quick refresh to update list
  };

  if (loading) return <div className="p-10 text-center text-slate-400">Loading library...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
        <AdminNavbar />
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/admin')} className="p-2 hover:bg-slate-100 rounded-full transition">
                    <ArrowLeft size={24} className="text-slate-600"/>
                </button>
                <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-2">
                    <Folder className="text-indigo-600" /> Contract Library
                </h1>
            </div>
           
        </div>

        {/* CONTRACTS GRID (Grouped) */}
        {Object.keys(contracts).length === 0 ? (
            <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-slate-400 font-bold">No contracts found.</p>
            </div>
        ) : (
            Object.entries(contracts).map(([groupName, items]) => (
                <div key={groupName} className="mb-10 animate-in fade-in slide-in-from-bottom-4">
                    <h2 className="text-xl font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">
                        {groupName}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {items.map(contract => (
                            <div key={contract.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition group relative">
                                <h3 className="font-bold text-lg text-slate-800 mb-2 pr-8">{contract.title}</h3>
                                <p className="text-slate-500 text-sm line-clamp-2 mb-4">{contract.description}</p>
                                
                                <div className="flex items-center gap-3 text-sm font-bold text-slate-400">
                                    <span className="text-green-600">${contract.bounty}</span>
                                    <span>•</span>
                                    <span className="text-indigo-500">{contract.xp_reward} XP</span>
                                </div>

                                {/* EDIT / DELETE OVERLAY */}
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => navigate(`/admin/edit/${contract.id}`)}
                                        className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100"
                                        title="Edit"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(contract.id)}
                                        className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                                        title="Delete"
                                    >
                                        <Trash size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))
        )}
    </div>
  );
}