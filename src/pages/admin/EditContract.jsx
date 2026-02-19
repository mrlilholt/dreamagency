import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { Save, ArrowLeft, Trash, Plus } from "lucide-react";
import AdminShell from "../../components/AdminShell";

const MAX_CONTRACT_IMAGE_BYTES = 200 * 1024;

export default function EditContract() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  // Initialize with empty defaults
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    description_image_url: "",
    bounty: 0,
    xp_reward: 0,
    class_id: "Global",
    status: "live",
    scheduled_date: ""
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
                description_image_url: data.description_image_url || "",
                bounty: data.bounty,
                xp_reward: data.xp_reward,
                class_id: data.class_id || "Global",
                status: data.status && data.status !== "open" ? data.status : "live",
                scheduled_date: data.scheduled_date || ""
            });
            // Convert Stages Object {1:{...}, 2:{...}} back to Array for easy editing
            const stagesArray = Object.values(data.stages || {}).map((stage) => ({
              ...stage,
              resources: Array.isArray(stage.resources) ? stage.resources : []
            }));
            setStages(stagesArray);
        }
        setLoading(false);
    };
    fetchData();
  }, [id]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (formData.status === "scheduled" && !formData.scheduled_date) {
      alert("Please choose a launch date for scheduled contracts.");
      return;
    }
    // Convert Array back to Object Map
    const stagesMap = {};
    stages.forEach((s, i) => {
        const cleanedResources = Array.isArray(s.resources)
          ? s.resources.filter((resource) => resource?.url || resource?.label)
          : [];
        stagesMap[i + 1] = {
            ...s,
            resources: cleanedResources
        };
    });

    await updateDoc(doc(db, "contracts", id), {
        ...formData,
        status: formData.status && formData.status !== "open" ? formData.status : "live",
        scheduled_date: formData.status === "scheduled" ? formData.scheduled_date : "",
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

  const handleBriefImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_CONTRACT_IMAGE_BYTES) {
      alert("Image too large. Please upload a file 200KB or smaller.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) return;
      setFormData((prev) => ({ ...prev, description_image_url: dataUrl }));
    };
    reader.onerror = () => {
      alert("Failed to read image file.");
    };
    reader.readAsDataURL(file);
  };

  const handleStageImageChange = (index, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_CONTRACT_IMAGE_BYTES) {
      alert("Image too large. Please upload a file 200KB or smaller.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) return;
      setStages((prev) => {
        const nextStages = [...prev];
        nextStages[index] = { ...nextStages[index], image_url: dataUrl };
        return nextStages;
      });
    };
    reader.onerror = () => {
      alert("Failed to read image file.");
    };
    reader.readAsDataURL(file);
  };

  const addStageResource = (index) => {
    setStages((prev) => {
      const nextStages = [...prev];
      const currentResources = Array.isArray(nextStages[index]?.resources)
        ? nextStages[index].resources
        : [];
      nextStages[index] = {
        ...nextStages[index],
        resources: [...currentResources, { label: "", url: "" }]
      };
      return nextStages;
    });
  };

  const updateStageResource = (stageIndex, resourceIndex, field, value) => {
    setStages((prev) => {
      const nextStages = [...prev];
      const resources = Array.isArray(nextStages[stageIndex]?.resources)
        ? [...nextStages[stageIndex].resources]
        : [];
      resources[resourceIndex] = {
        ...resources[resourceIndex],
        [field]: value
      };
      nextStages[stageIndex] = {
        ...nextStages[stageIndex],
        resources
      };
      return nextStages;
    });
  };

  const removeStageResource = (stageIndex, resourceIndex) => {
    setStages((prev) => {
      const nextStages = [...prev];
      const resources = Array.isArray(nextStages[stageIndex]?.resources)
        ? nextStages[stageIndex].resources.filter((_, idx) => idx !== resourceIndex)
        : [];
      nextStages[stageIndex] = {
        ...nextStages[stageIndex],
        resources
      };
      return nextStages;
    });
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
                <div className="col-span-2">
                    <label className="block font-bold mb-1">Brief Image (optional)</label>
                    <input
                        type="file"
                        accept="image/*"
                        className="w-full border p-2 rounded bg-white"
                        onChange={handleBriefImageChange}
                    />
                    <p className="text-xs text-slate-500 mt-2">Keep images small (200KB max) to fit within Firestore limits.</p>
                    {formData.description_image_url && (
                        <div className="mt-3">
                            <img
                                src={formData.description_image_url}
                                alt="Contract brief preview"
                                className="w-full max-h-64 object-cover rounded-lg border border-slate-200"
                            />
                            <button
                                type="button"
                                onClick={() => setFormData((prev) => ({ ...prev, description_image_url: "" }))}
                                className="mt-2 text-xs font-bold text-slate-500 hover:text-red-500"
                            >
                                Remove image
                            </button>
                        </div>
                    )}
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
                <div>
                    <label className="block font-bold mb-1">Status</label>
                    <select
                        className="w-full border p-2 rounded bg-white"
                        value={formData.status || "live"}
                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                    >
                        <option value="live">Live</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="archived">Archived</option>
                    </select>
                </div>
                {formData.status === "scheduled" && (
                    <div>
                        <label className="block font-bold mb-1">Launch Date</label>
                        <input
                            type="date"
                            className="w-full border p-2 rounded bg-white"
                            value={formData.scheduled_date || ""}
                            onChange={e => setFormData({ ...formData, scheduled_date: e.target.value })}
                        />
                    </div>
                )}
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h2 className="font-bold text-xl mb-4">Stages</h2>
                {stages.map((stage, i) => (
                    <div key={i} className="flex gap-4 mb-4 items-start bg-slate-50 p-4 rounded border">
                        <span className="font-bold text-slate-400 mt-2">#{i+1}</span>
                        <div className="flex-1 space-y-2">
                            <input className="w-full border p-2 rounded" value={stage.name} onChange={(e) => updateStage(i, 'name', e.target.value)} placeholder="Stage Name" />
                            <input className="w-full border p-2 rounded text-sm" value={stage.req} onChange={(e) => updateStage(i, 'req', e.target.value)} placeholder="Requirement" />
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2">Stage Image (optional)</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="w-full border p-2 rounded bg-white text-sm"
                                    onChange={(event) => handleStageImageChange(i, event)}
                                />
                                {stage.image_url && (
                                    <div className="mt-2">
                                        <img
                                            src={stage.image_url}
                                            alt={`Stage ${i + 1} preview`}
                                            className="w-full max-h-48 object-cover rounded-md border border-slate-200"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => updateStage(i, "image_url", "")}
                                            className="mt-1 text-xs font-bold text-slate-500 hover:text-red-500"
                                        >
                                            Remove image
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div>
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-bold text-slate-500 mb-2">Stage Resources (optional)</label>
                                    <button
                                        type="button"
                                        onClick={() => addStageResource(i)}
                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                                    >
                                        + Add Resource
                                    </button>
                                </div>
                                {(stage.resources || []).length === 0 && (
                                    <p className="text-xs text-slate-400">Add links, videos, or reference docs for this stage.</p>
                                )}
                                {(stage.resources || []).map((resource, resourceIndex) => (
                                    <div key={resourceIndex} className="mt-2 grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
                                        <input
                                            className="md:col-span-2 w-full border p-2 rounded bg-white text-xs"
                                            placeholder="Label (optional)"
                                            value={resource.label || ""}
                                            onChange={(event) =>
                                                updateStageResource(i, resourceIndex, "label", event.target.value)
                                            }
                                        />
                                        <input
                                            className="md:col-span-2 w-full border p-2 rounded bg-white text-xs"
                                            placeholder="https://"
                                            value={resource.url || ""}
                                            onChange={(event) =>
                                                updateStageResource(i, resourceIndex, "url", event.target.value)
                                            }
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeStageResource(i, resourceIndex)}
                                            className="text-xs font-bold text-slate-400 hover:text-red-500"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <button type="button" onClick={() => {
                            const newStages = stages.filter((_, idx) => idx !== i);
                            setStages(newStages);
                        }} className="text-red-400 hover:text-red-600 p-2"><Trash size={18}/></button>
                    </div>
                ))}
                <button type="button" onClick={() => setStages([...stages, {name: "New Stage", req: "", status: "locked", image_url: "", resources: []}])} className="w-full py-3 border-2 border-dashed border-slate-200 text-slate-400 font-bold hover:border-indigo-300 hover:text-indigo-600 rounded-lg">
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
