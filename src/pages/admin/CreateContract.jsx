import { useEffect, useState } from "react";
import { db } from "../../lib/firebase"; 
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useLocation, useNavigate } from "react-router-dom";
import { Save, Layout, ArrowLeft, Plus, Trash } from "lucide-react";
// 1. Import your config
import { CLASS_CODES } from "../../lib/gameConfig"; 
import AdminShell from "../../components/AdminShell";

const MAX_CONTRACT_IMAGE_BYTES = 200 * 1024;

const DEFAULT_STAGES = [
  { name: "Research & Ideate", req: "Submit 3 sketches and research links.", image_url: "", resources: [] },
  { name: "Proposal", req: "Submit a 1-paragraph proposal.", image_url: "", resources: [] },
  { name: "Prototype", req: "Submit photo/link of first build.", image_url: "", resources: [] },
  { name: "Test", req: "Submit testing data/feedback notes.", image_url: "", resources: [] },
  { name: "Iterate", req: "What changes did you make based on data?", image_url: "", resources: [] },
  { name: "Deliver & Reflect", req: "Final project link and reflection.", image_url: "", resources: [] }
];

const normalizeStageList = (stages) => {
  if (!stages) return [];
  if (Array.isArray(stages)) return stages;
  if (typeof stages === "object") return Object.values(stages);
  return [];
};

const cloneStageList = (stages) => stages.map((stage) => ({
  name: stage.name || "",
  req: stage.req || "",
  image_url: stage.image_url || "",
  resources: Array.isArray(stage.resources) ? stage.resources : []
}));

export default function CreateContract() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    description_image_url: "",
    bounty: 500,
    xp_reward: 100,
    class_id: "all", // Default to global
    status: "live",
    scheduled_date: ""
  });

  const [stages, setStages] = useState(() => cloneStageList(DEFAULT_STAGES));

  useEffect(() => {
    const duplicate = location.state?.duplicateContract;
    if (!duplicate) return;
    const stageList = normalizeStageList(duplicate.stages);
    setFormData({
      title: duplicate.title ? `${duplicate.title} (Copy)` : "",
      description: duplicate.description || "",
      description_image_url: duplicate.description_image_url || "",
      bounty: Number(duplicate.bounty) || 0,
      xp_reward: Number(duplicate.xp_reward) || 0,
      class_id: duplicate.class_id || "all",
      status: duplicate.status && duplicate.status !== "open" ? duplicate.status : "archived",
      scheduled_date: duplicate.scheduled_date || ""
    });
    setStages(stageList.length ? cloneStageList(stageList) : cloneStageList(DEFAULT_STAGES));
  }, [location.state]);

  const handleStageChange = (index, field, value) => {
    const newStages = [...stages];
    newStages[index][field] = value;
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

  const addStage = () => {
    setStages([...stages, { name: "", req: "", image_url: "", resources: [] }]);
  };

  const removeStage = (index) => {
    if (stages.length === 1) return alert("You need at least one stage!");
    const newStages = stages.filter((_, i) => i !== index);
    setStages(newStages);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.status === "scheduled" && !formData.scheduled_date) {
      alert("Please choose a launch date for scheduled contracts.");
      return;
    }
    setLoading(true);

    try {
      const stagesMap = {};
      stages.forEach((stage, index) => {
        const cleanedResources = Array.isArray(stage.resources)
          ? stage.resources.filter((resource) => resource?.url || resource?.label)
          : [];
        stagesMap[index + 1] = {
            name: stage.name,
            req: stage.req,
            image_url: stage.image_url || "",
            resources: cleanedResources,
            status: "locked" 
        };
      });

      await addDoc(collection(db, "contracts"), {
        ...formData,
        stages: stagesMap,
        status: formData.status && formData.status !== "open" ? formData.status : "live",
        scheduled_date: formData.status === "scheduled" ? formData.scheduled_date : "",
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
                <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Brief Image (optional)</label>
                    <input
                        type="file"
                        accept="image/*"
                        className="w-full border p-3 rounded-lg bg-white"
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
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Status</label>
                    <select
                        className="w-full border p-3 rounded-lg bg-white"
                        value={formData.status || "live"}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                        <option value="live">Live</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="archived">Archived</option>
                    </select>
                </div>
                {formData.status === "scheduled" && (
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Launch Date</label>
                        <input
                            type="date"
                            className="w-full border p-3 rounded-lg bg-white"
                            value={formData.scheduled_date || ""}
                            onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                        />
                    </div>
                )}

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
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2">Stage Image (optional)</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="w-full border p-2 rounded bg-white text-sm"
                                    onChange={(event) => handleStageImageChange(index, event)}
                                />
                                {stage.image_url && (
                                    <div className="mt-2">
                                        <img
                                            src={stage.image_url}
                                            alt={`Stage ${index + 1} preview`}
                                            className="w-full max-h-48 object-cover rounded-md border border-slate-200"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleStageChange(index, "image_url", "")}
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
                                        onClick={() => addStageResource(index)}
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
                                                updateStageResource(index, resourceIndex, "label", event.target.value)
                                            }
                                        />
                                        <input
                                            className="md:col-span-2 w-full border p-2 rounded bg-white text-xs"
                                            placeholder="https://"
                                            value={resource.url || ""}
                                            onChange={(event) =>
                                                updateStageResource(index, resourceIndex, "url", event.target.value)
                                            }
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeStageResource(index, resourceIndex)}
                                            className="text-xs font-bold text-slate-400 hover:text-red-500"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
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
