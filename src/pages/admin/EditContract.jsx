import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { Save, ArrowLeft, Trash, Plus } from "lucide-react";
import AdminShell from "../../components/AdminShell";

export default function EditContract() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  // Initialize with empty defaults
  const [formData, setFormData] = useState({
    title: "", description: "", bounty: 0, xp_reward: 0, class_id: "Global"
  });
  const [stages, setStages] = useState([]);

  // Fetch Data on Load
  useEffect(() => {
    const fetchData = async () => {
        const snap = await getDoc(doc(db, "contracts", id));
        if (snap.exists()) {
            const data = snap.data();
            setFormData({
                title: data.title,
                description: data.description,
                bounty: data.bounty,
                xp_reward: data.xp_reward,
                class_id: data.class_id || "Global"
            });
            // Convert Stages Object {1:{...}, 2:{...}} back to Array for easy editing
            const stagesArray = Object.values(data.stages || {});
            setStages(stagesArray);
        }
        setLoading(false);
    };
    fetchData();
  }, [id]);

  const handleSave = async (e) => {
    e.preventDefault();
    // Convert Array back to Object Map
    const stagesMap = {};
    stages.forEach((s, i) => stagesMap[i+1] = { ...s });

    await updateDoc(doc(db, "contracts", id), {
        ...formData,
        stages: stagesMap
    });
    alert("Changes Saved!");
    navigate('/admin/contracts');
  };

  // Helper to update stage fields
  const updateStage = (index, field, val) => {
    const newStages = [...stages];
    newStages[index][field] = val;
    setStages(newStages);
  };

  if(loading) return <div className="p-10 text-center">Loading...</div>;

  return (
    <AdminShell>
    <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate('/admin/contracts')} className="flex items-center text-slate-500 mb-6 hover:text-slate-800">
            <ArrowLeft size={18} className="mr-2"/> Back to Library
        </button>
        
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Edit Contract: {formData.title}</h1>

        <form onSubmit={handleSave} className="space-y-8">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm grid grid-cols-2 gap-6">
                <div className="col-span-2">
                    <label className="block font-bold mb-1">Title</label>
                    <input className="w-full border p-2 rounded" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                </div>
                <div className="col-span-2">
                    <label className="block font-bold mb-1">Description</label>
                    <textarea className="w-full border p-2 rounded h-24" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
                <div>
                    <label className="block font-bold mb-1">Bounty ($)</label>
                    <input type="number" className="w-full border p-2 rounded" value={formData.bounty} onChange={e => setFormData({...formData, bounty: Number(e.target.value)})} />
                </div>
                <div>
                    <label className="block font-bold mb-1">XP Reward</label>
                    <input 
                        type="number" 
                        className="w-full border p-2 rounded" 
                        value={formData.xp_reward} 
                        onChange={e => setFormData({...formData, xp_reward: Number(e.target.value)})} 
                    />
                </div>
                <div>
                    <label className="block font-bold mb-1">Class ID</label>
                    <input className="w-full border p-2 rounded" value={formData.class_id} onChange={e => setFormData({...formData, class_id: e.target.value})} />
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h2 className="font-bold text-xl mb-4">Stages</h2>
                {stages.map((stage, i) => (
                    <div key={i} className="flex gap-4 mb-4 items-start bg-slate-50 p-4 rounded border">
                        <span className="font-bold text-slate-400 mt-2">#{i+1}</span>
                        <div className="flex-1 space-y-2">
                            <input className="w-full border p-2 rounded" value={stage.name} onChange={(e) => updateStage(i, 'name', e.target.value)} placeholder="Stage Name" />
                            <input className="w-full border p-2 rounded text-sm" value={stage.req} onChange={(e) => updateStage(i, 'req', e.target.value)} placeholder="Requirement" />
                        </div>
                        <button type="button" onClick={() => {
                            const newStages = stages.filter((_, idx) => idx !== i);
                            setStages(newStages);
                        }} className="text-red-400 hover:text-red-600 p-2"><Trash size={18}/></button>
                    </div>
                ))}
                <button type="button" onClick={() => setStages([...stages, {name: "New Stage", req: "", status: "locked"}])} className="w-full py-3 border-2 border-dashed border-slate-200 text-slate-400 font-bold hover:border-indigo-300 hover:text-indigo-600 rounded-lg">
                    + Add Stage
                </button>
            </div>

            <button type="submit" className="bg-indigo-600 text-white font-bold text-lg px-8 py-4 rounded-xl shadow-lg hover:bg-indigo-700 w-full flex items-center justify-center gap-2">
                <Save /> Save Changes
            </button>
        </form>
    </div>
    </AdminShell>
  );
}
