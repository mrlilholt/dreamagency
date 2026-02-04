import { useState } from "react";
import { db } from "../../lib/firebase"; 
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { Save, Layout, ArrowLeft, Plus, Trash } from "lucide-react";
// 1. Import your config
import { CLASS_CODES } from "../../lib/gameConfig"; 
import AdminShell from "../../components/AdminShell";

export default function CreateContract() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    bounty: 500,
    xp_reward: 100,
    class_id: "all" // Default to global
  });

  const [stages, setStages] = useState([
    { name: "Research & Ideate", req: "Submit 3 sketches and research links." },
    { name: "Proposal", req: "Submit a 1-paragraph proposal." },
    { name: "Prototype", req: "Submit photo/link of first build." },
    { name: "Test", req: "Submit testing data/feedback notes." },
    { name: "Iterate", req: "What changes did you make based on data?" },
    { name: "Deliver & Reflect", req: "Final project link and reflection." }
  ]);

  const handleStageChange = (index, field, value) => {
    const newStages = [...stages];
    newStages[index][field] = value;
    setStages(newStages);
  };

  const addStage = () => {
    setStages([...stages, { name: "", req: "" }]);
  };

  const removeStage = (index) => {
    if (stages.length === 1) return alert("You need at least one stage!");
    const newStages = stages.filter((_, i) => i !== index);
    setStages(newStages);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const stagesMap = {};
      stages.forEach((stage, index) => {
        stagesMap[index + 1] = {
            name: stage.name,
            req: stage.req,
            status: "locked" 
        };
      });

      await addDoc(collection(db, "contracts"), {
        ...formData,
        stages: stagesMap,
        status: "open",
        created_at: serverTimestamp()
      });

      alert("Contract Created Successfully!");
      navigate("/admin/contracts");

    } catch (error) {
      console.error(error);
      alert("Error creating contract");
    }
    setLoading(false);
  };

  return (
    <AdminShell>
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate('/admin/contracts')} className="flex items-center text-slate-500 mb-6 hover:text-slate-800">
            <ArrowLeft size={18} className="mr-2"/> Back to Library
      </button>

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Layout className="text-indigo-600"/> Contract Builder
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* SECTION 1: BASIC INFO */}
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800 mb-6 border-b pb-2">Contract Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Contract Title</label>
                    <input 
                        required
                        className="w-full border p-3 rounded-lg" 
                        placeholder="e.g. Project Alpha: The Logo Design"
                        value={formData.title}
                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Client Brief</label>
                    <textarea 
                        required
                        className="w-full border p-3 rounded-lg h-32" 
                        placeholder="Describe the objectives..."
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Bounty ($)</label>
                    <input 
                        type="number"
                        className="w-full border p-3 rounded-lg" 
                        value={formData.bounty}
                        onChange={(e) => setFormData({...formData, bounty: parseInt(e.target.value)})}
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">XP Reward</label>
                    <input 
                        type="number"
                        className="w-full border p-3 rounded-lg" 
                        value={formData.xp_reward}
                        onChange={(e) => setFormData({...formData, xp_reward: parseInt(e.target.value)})}
                    />
                </div>
                
                {/* --- UPDATED CLASS DROPDOWN --- */}
                <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Assign to Class</label>
                    <select 
                        className="w-full border p-3 rounded-lg bg-white"
                        value={formData.class_id}
                        onChange={(e) => setFormData({...formData, class_id: e.target.value})}
                    >
                        <option value="all">Global (All Agents)</option>
                        {Object.values(CLASS_CODES).map((cls) => (
                            <option key={cls.id} value={cls.id}>
                                {cls.name}
                            </option>
                        ))}
                    </select>
                </div>

            </div>
        </div>

        {/* SECTION 2: STAGES */}
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800 mb-6 border-b pb-2 flex justify-between items-center">
                <span>Contract Stages</span>
                <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded">
                    {stages.length} Stages Defined
                </span>
            </h2>

            <div className="space-y-4">
                {stages.map((stage, index) => (
                    <div key={index} className="flex gap-4 items-start bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="bg-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-slate-500 border shadow-sm shrink-0">
                            {index + 1}
                        </div>
                        <div className="flex-1 grid gap-4">
                            <input 
                                className="w-full border p-2 rounded bg-white font-bold text-slate-800"
                                placeholder="Stage Name"
                                value={stage.name}
                                onChange={(e) => handleStageChange(index, "name", e.target.value)}
                            />
                            <input 
                                className="w-full border p-2 rounded bg-white text-sm"
                                placeholder="Requirement"
                                value={stage.req}
                                onChange={(e) => handleStageChange(index, "req", e.target.value)}
                            />
                        </div>
                        <button 
                            type="button" 
                            onClick={() => removeStage(index)}
                            className="text-slate-400 hover:text-red-500 p-2"
                        >
                            <Trash size={18} />
                        </button>
                    </div>
                ))}
            </div>

            <button 
                type="button" 
                onClick={addStage}
                className="mt-6 w-full py-3 border-2 border-dashed border-slate-300 text-slate-500 font-bold rounded-lg hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition flex items-center justify-center gap-2"
            >
                <Plus size={20}/> Add Another Stage
            </button>
        </div>

        {/* SUBMIT */}
        <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl text-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition flex items-center justify-center gap-2"
        >
            {loading ? "Publishing..." : <><Save size={20}/> Publish Contract</>}
        </button>

      </form>
    </div>
    </AdminShell>
  );
}
