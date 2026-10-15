import React, { useState, useEffect, useMemo } from "react";

const RAID_BOSS_COUNTERS = {
  "Rayquaza": {
    types: ["Dragon", "Flying"],
    weaknesses: ["Ice (2.56x)", "Dragon", "Fairy", "Rock"],
    counters: [
      { name: "Mamoswine", fast: "Powder Snow", charged: "Avalanche", tier: "Top Non-Mega" },
      { name: "Baxcalibur", fast: "Ice Fang", charged: "Avalanche", tier: "Top Non-Mega" },
      { name: "Glaceon", fast: "Frost Breath", charged: "Avalanche", tier: "Budget" },
      { name: "Mega Rayquaza", fast: "Dragon Tail", charged: "Outrage", tier: "Mega" },
      { name: "Mega Gardevoir", fast: "Charm", charged: "Dazzling Gleam", tier: "Mega" },
      { name: "Shadow Mamoswine", fast: "Powder Snow", charged: "Avalanche", tier: "Shadow" }
    ]
  },
  "Kyogre": {
    types: ["Water"],
    weaknesses: ["Grass", "Electric"],
    counters: [
      { name: "Kartana", fast: "Razor Leaf", charged: "Leaf Blade", tier: "Top Non-Mega" },
      { name: "Xurkitree", fast: "Thunder Shock", charged: "Discharge", tier: "Top Non-Mega" },
      { name: "Zekrom", fast: "Charge Beam", charged: "Fusion Bolt", tier: "Top Non-Mega" },
      { name: "Mega Sceptile", fast: "Bullet Seed", charged: "Frenzy Plant", tier: "Mega" },
      { name: "Mega Manectric", fast: "Thunder Fang", charged: "Wild Charge", tier: "Mega" },
      { name: "Roserade", fast: "Bullet Seed", charged: "Grass Knot", tier: "Budget" }
    ]
  },
  "Groudon": {
    types: ["Ground"],
    weaknesses: ["Water", "Grass", "Ice"],
    counters: [
      { name: "Primal Kyogre", fast: "Waterfall", charged: "Origin Pulse", tier: "Mega" },
      { name: "Kartana", fast: "Razor Leaf", charged: "Leaf Blade", tier: "Top Non-Mega" },
      { name: "Mega Swampert", fast: "Water Gun", charged: "Hydro Cannon", tier: "Mega" },
      { name: "Mamoswine", fast: "Powder Snow", charged: "Avalanche", tier: "Top Non-Mega" },
      { name: "Shadow Feraligatr", fast: "Waterfall", charged: "Hydro Cannon", tier: "Shadow" }
    ]
  },
  "Mewtwo": {
    types: ["Psychic"],
    weaknesses: ["Dark", "Ghost", "Bug"],
    counters: [
      { name: "Mega Tyranitar", fast: "Bite", charged: "Brutal Swing", tier: "Mega" },
      { name: "Mega Gengar", fast: "Shadow Claw", charged: "Shadow Ball", tier: "Mega" },
      { name: "Hydreigon", fast: "Bite", charged: "Brutal Swing", tier: "Top Non-Mega" },
      { name: "Giratina (Origin)", fast: "Shadow Claw", charged: "Shadow Force", tier: "Top Non-Mega" },
      { name: "Chandelure", fast: "Hex", charged: "Shadow Ball", tier: "Budget" }
    ]
  },
  "Necrozma (Dusk Mane)": {
    types: ["Psychic", "Steel"],
    weaknesses: ["Dark", "Ghost", "Fire", "Ground"],
    counters: [
      { name: "Mega Tyranitar", fast: "Bite", charged: "Brutal Swing", tier: "Mega" },
      { name: "Mega Gengar", fast: "Shadow Claw", charged: "Shadow Ball", tier: "Mega" },
      { name: "Reshiram", fast: "Fire Fang", charged: "Fusion Flare", tier: "Top Non-Mega" },
      { name: "Hydreigon", fast: "Bite", charged: "Brutal Swing", tier: "Top Non-Mega" },
      { name: "Primal Groudon", fast: "Mud Shot", charged: "Precipice Blades", tier: "Mega" }
    ]
  },
  "Necrozma (Dawn Wings)": {
    types: ["Psychic", "Ghost"],
    weaknesses: ["Ghost (2.56x)", "Dark (2.56x)"],
    counters: [
      { name: "Mega Tyranitar", fast: "Bite", charged: "Brutal Swing", tier: "Mega" },
      { name: "Mega Gengar", fast: "Shadow Claw", charged: "Shadow Ball", tier: "Mega" },
      { name: "Hydreigon", fast: "Bite", charged: "Brutal Swing", tier: "Top Non-Mega" },
      { name: "Tyranitar", fast: "Bite", charged: "Brutal Swing", tier: "Top Non-Mega" },
      { name: "Chandelure", fast: "Hex", charged: "Shadow Ball", tier: "Budget" }
    ]
  },
  "Dialga": {
    types: ["Steel", "Dragon"],
    weaknesses: ["Fighting", "Ground"],
    counters: [
      { name: "Terrakion", fast: "Double Kick", charged: "Sacred Sword", tier: "Top Non-Mega" },
      { name: "Primal Groudon", fast: "Mud Shot", charged: "Precipice Blades", tier: "Mega" },
      { name: "Mega Lucario", fast: "Force Palm", charged: "Aura Sphere", tier: "Mega" },
      { name: "Conkeldurr", fast: "Counter", charged: "Dynamic Punch", tier: "Top Non-Mega" },
      { name: "Machamp", fast: "Counter", charged: "Dynamic Punch", tier: "Budget" }
    ]
  },
  "Palkia": {
    types: ["Water", "Dragon"],
    weaknesses: ["Dragon", "Fairy"],
    counters: [
      { name: "Mega Rayquaza", fast: "Dragon Tail", charged: "Breaking Swipe", tier: "Mega" },
      { name: "Mega Gardevoir", fast: "Charm", charged: "Dazzling Gleam", tier: "Mega" },
      { name: "Dialga", fast: "Dragon Breath", charged: "Draco Meteor", tier: "Top Non-Mega" },
      { name: "Dragonite", fast: "Dragon Tail", charged: "Outrage", tier: "Budget" },
      { name: "Togekiss", fast: "Charm", charged: "Dazzling Gleam", tier: "Budget" }
    ]
  }
};

// Canvas helper to downscale and boost contrast so OCR succeeds on mobile
function preprocessImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        // Resize down to max width 1000px so mobile wasm doesn't crash
        const maxDim = 1000;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to grayscale & contrast enhance
        const imgData = ctx.getImageData(0, 0, width, height);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          // Simple contrast stretch
          const contrast = gray > 140 ? 255 : gray < 70 ? 0 : gray;
          d[i] = contrast;
          d[i + 1] = contrast;
          d[i + 2] = contrast;
        }
        ctx.putImageData(imgData, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas conversion failed"));
        }, "image/jpeg", 0.9);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [activeTab, setActiveTab] = useState("search");
  const [inventory, setInventory] = useState(() => {
    const saved = localStorage.getItem("pogo_inventory");
    return saved ? JSON.parse(saved) : [
      { id: 1, name: "Mamoswine", cp: 3120, ivAtk: 15, ivDef: 14, ivHp: 15, fastMove: "Powder Snow", chargedMove: "Avalanche", form: "Shadow" },
      { id: 2, name: "Kartana", cp: 2980, ivAtk: 14, ivDef: 15, ivHp: 13, fastMove: "Razor Leaf", chargedMove: "Leaf Blade", form: "Regular" }
    ];
  });

  const [bossQuery, setBossQuery] = useState("");
  const [selectedBoss, setSelectedBoss] = useState("Rayquaza");

  const [formData, setFormData] = useState({
    name: "",
    cp: "",
    form: "Regular",
    ivAtk: 15,
    ivDef: 15,
    ivHp: 15,
    fastMove: "",
    chargedMove: ""
  });

  const [ocrStatus, setOcrStatus] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [uploadedPreview, setUploadedPreview] = useState(null);
  const [rawOcrText, setRawOcrText] = useState("");

  useEffect(() => {
    localStorage.setItem("pogo_inventory", JSON.stringify(inventory));
  }, [inventory]);

  const bossList = Object.keys(RAID_BOSS_COUNTERS);
  const filteredBosses = useMemo(() => {
    if (!bossQuery.trim()) return bossList;
    return bossList.filter((b) => b.toLowerCase().includes(bossQuery.toLowerCase()));
  }, [bossQuery, bossList]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedPreview(URL.createObjectURL(file));
    setIsScanning(true);
    setRawOcrText("");
    setOcrStatus("Compressing and enhancing image for OCR...");

    try {
      if (!window.Tesseract) {
        throw new Error("OCR library not ready. Check internet connection.");
      }

      // 1. Optimize image through Canvas first
      const processedBlob = await preprocessImage(file);

      // 2. Run Tesseract recognition
      setOcrStatus("Reading text...");
      const worker = await window.Tesseract.createWorker({
        logger: (m) => {
          if (m.status === "recognizing text") {
            setOcrStatus(`Scanning screenshot: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      await worker.loadLanguage("eng");
      await worker.initialize("eng");
      const { data } = await worker.recognize(processedBlob);
      await worker.terminate();

      const raw = data.text || "";
      setRawOcrText(raw);

      // Extract CP
      const cpRegex = /(?:CP|GP|CF|co|op)\s*([0-9]{2,4})/i;
      const cpMatch = raw.match(cpRegex);
      const detectedCp = cpMatch ? cpMatch[1] : "";

      // Extract Form
      let detectedForm = "Regular";
      if (/shadow/i.test(raw) || /frustration/i.test(raw)) detectedForm = "Shadow";
      if (/purified/i.test(raw) || /return/i.test(raw)) detectedForm = "Purified";

      // Match Species against known boss/counter dictionary
      let detectedName = "";
      for (const b of bossList) {
        if (new RegExp(b, "i").test(raw)) {
          detectedName = b;
          break;
        }
        for (const c of RAID_BOSS_COUNTERS[b].counters) {
          if (new RegExp(c.name.replace(/^(Mega|Shadow)\s*/i, ""), "i").test(raw)) {
            detectedName = c.name.replace(/^(Mega|Shadow)\s*/i, "");
            break;
          }
        }
        if (detectedName) break;
      }

      setFormData((prev) => ({
        ...prev,
        name: detectedName || prev.name,
        cp: detectedCp || prev.cp,
        form: detectedForm
      }));

      setOcrStatus(
        detectedCp || detectedName
          ? `✓ Found ${detectedName ? detectedName : "Pokémon"} (CP ${detectedCp || "?"})!`
          : "Done scanning. Please verify extracted fields below."
      );
    } catch (err) {
      console.error(err);
      setOcrStatus(`Error: ${err.message || "Could not read image"}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleAddPokemon = (e) => {
    e.preventDefault();
    if (!formData.name) return;
    const newEntry = {
      ...formData,
      id: Date.now(),
      cp: Number(formData.cp) || 0,
      ivAtk: Number(formData.ivAtk),
      ivDef: Number(formData.ivDef),
      ivHp: Number(formData.ivHp)
    };
    setInventory([newEntry, ...inventory]);
    setFormData({ name: "", cp: "", form: "Regular", ivAtk: 15, ivDef: 15, ivHp: 15, fastMove: "", chargedMove: "" });
    setUploadedPreview(null);
    setOcrStatus("");
    setRawOcrText("");
    setActiveTab("inventory");
  };

  const removePokemon = (id) => {
    setInventory(inventory.filter((p) => p.id !== id));
  };

  const findOwnedCounters = (counterName) => {
    const cleanCounter = counterName.replace(/^(Mega|Shadow|Primal)\s*/i, "").trim().toLowerCase();
    return inventory.filter((item) => {
      const cleanItem = item.name.replace(/^(Mega|Shadow|Primal)\s*/i, "").trim().toLowerCase();
      return cleanItem.includes(cleanCounter) || cleanCounter.includes(cleanItem);
    });
  };

  const activeBossData = RAID_BOSS_COUNTERS[selectedBoss];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-xl font-bold tracking-wide text-amber-400 flex items-center gap-2">
          ⚡ PoGo Counter Scout
        </h1>
        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
          <button
            onClick={() => setActiveTab("search")}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition ${
              activeTab === "search" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            Counters
          </button>
          <button
            onClick={() => setActiveTab("add")}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition ${
              activeTab === "add" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            + Add / Scan
          </button>
          <button
            onClick={() => setActiveTab("inventory")}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition ${
              activeTab === "inventory" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            My Box ({inventory.length})
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-6 max-w-5xl mx-auto w-full flex-1">
        {activeTab === "search" && (
          <div className="space-y-6">
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4">
              <div>
                <label className="text-xs uppercase text-slate-400 font-bold block mb-1">
                  Type Raid Boss Name (Live Search)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search e.g. Rayquaza, Kyogre, Necrozma..."
                    value={bossQuery}
                    onChange={(e) => setBossQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white font-medium focus:outline-none focus:border-amber-400 pl-10"
                  />
                  <span className="absolute left-3 top-2.5 text-slate-400 text-lg">🔍</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {filteredBosses.length > 0 ? (
                  filteredBosses.map((boss) => (
                    <button
                      key={boss}
                      onClick={() => {
                        setSelectedBoss(boss);
                        setBossQuery("");
                      }}
                      className={`px-3 py-1 text-xs rounded-full font-semibold border transition ${
                        selectedBoss === boss
                          ? "bg-amber-500 text-slate-950 border-amber-400 shadow"
                          : "bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500"
                      }`}
                    >
                      {boss}
                    </button>
                  ))
                ) : (
                  <span className="text-xs text-rose-400">No boss matching "{bossQuery}"</span>
                )}
              </div>

              {activeBossData && (
                <div className="pt-3 border-t border-slate-700 flex flex-wrap gap-6 text-sm">
                  <div>
                    <span className="text-slate-400 text-xs block">Active Boss:</span>
                    <span className="font-bold text-amber-400 text-base">{selectedBoss}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs block">Types:</span>
                    <span className="font-semibold">{activeBossData.types.join(" / ")}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs block">Weaknesses:</span>
                    <span className="font-semibold text-rose-400">{activeBossData.weaknesses.join(", ")}</span>
                  </div>
                </div>
              )}
            </div>

            {activeBossData && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeBossData.counters.map((c, idx) => {
                  const owned = findOwnedCounters(c.name);
                  const isOwned = owned.length > 0;

                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border transition relative ${
                        isOwned
                          ? "bg-emerald-950/30 border-emerald-500/80 ring-1 ring-emerald-500/40"
                          : "bg-slate-800 border-slate-700"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg">{c.name}</h3>
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">
                              {c.tier}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            Moves: <span className="text-slate-200">{c.fast}</span> + <span className="text-slate-200">{c.charged}</span>
                          </p>
                        </div>

                        {isOwned ? (
                          <span className="bg-emerald-500 text-slate-950 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow">
                            ✓ Ready ({owned.length})
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500 italic">Not in Box</span>
                        )}
                      </div>

                      {isOwned && (
                        <div className="mt-3 pt-3 border-t border-emerald-900/50 space-y-1">
                          <p className="text-xs font-bold text-emerald-400 uppercase">Available in Box:</p>
                          {owned.map((p) => (
                            <div key={p.id} className="text-xs bg-emerald-950/60 p-2 rounded flex justify-between items-center text-emerald-200">
                              <span>
                                {p.form !== "Regular" && <strong className="text-amber-400">[{p.form}] </strong>}
                                <strong>CP {p.cp}</strong> | {p.fastMove || "Fast"} / {p.chargedMove || "Charged"}
                              </span>
                              <span className="font-mono bg-emerald-900 px-1.5 py-0.5 rounded">
                                {p.ivAtk}/{p.ivDef}/{p.ivHp} ({Math.round(((p.ivAtk + p.ivDef + p.ivHp) / 45) * 100)}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "add" && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 sm:p-6 max-w-xl mx-auto shadow-xl space-y-6">
            <div>
              <h2 className="text-lg font-bold text-amber-400 mb-1">Add or Scan Pokémon</h2>
              <p className="text-xs text-slate-400">
                Pick a screenshot from your photo library. The scanner will enhance contrast and read the CP and name.
              </p>
            </div>

            <div className="border-2 border-dashed border-slate-600 hover:border-amber-400 rounded-xl p-4 text-center bg-slate-900/50">
              <input
                type="file"
                accept="image/*"
                id="screenshot-input"
                onChange={handleImageUpload}
                className="hidden"
              />
              <label htmlFor="screenshot-input" className="cursor-pointer block">
                {uploadedPreview ? (
                  <div className="space-y-2">
                    <img src={uploadedPreview} alt="Preview" className="max-h-48 mx-auto rounded shadow border border-slate-700" />
                    <span className="text-xs text-amber-400 underline block">Tap to pick another image</span>
                  </div>
                ) : (
                  <div className="py-4">
                    <span className="text-3xl block mb-2">📸</span>
                    <span className="text-sm font-semibold text-slate-300 block">Tap to select Screenshot from Photos</span>
                    <span className="text-xs text-slate-500">Appraisal or Pokémon detail screen</span>
                  </div>
                )}
              </label>

              {ocrStatus && (
                <div className={`mt-3 text-xs font-semibold ${isScanning ? "text-amber-400 animate-pulse" : "text-emerald-400"}`}>
                  {ocrStatus}
                </div>
              )}

              {/* Debug toggle in case OCR misreads on certain phones */}
              {rawOcrText && (
                <details className="mt-3 text-left text-xs text-slate-400 bg-slate-950 p-2 rounded">
                  <summary className="cursor-pointer text-slate-300">View Detected Raw Text</summary>
                  <pre className="mt-2 whitespace-pre-wrap font-mono">{rawOcrText}</pre>
                </details>
              )}
            </div>

            <form onSubmit={handleAddPokemon} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Species Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mamoswine"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">CP</label>
                  <input
                    type="number"
                    placeholder="e.g. 3120"
                    value={formData.cp}
                    onChange={(e) => setFormData({ ...formData, cp: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Form / Variant</label>
                <div className="flex gap-2">
                  {["Regular", "Shadow", "Purified", "Mega"].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormData({ ...formData, form: f })}
                      className={`flex-1 py-1.5 text-xs rounded-lg font-bold border transition ${
                        formData.form === f
                          ? "bg-amber-500 border-amber-400 text-slate-950"
                          : "bg-slate-900 border-slate-700 text-slate-300"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block">Appraisal (IVs / 15)</span>
                {[
                  { key: "ivAtk", label: "Attack" },
                  { key: "ivDef", label: "Defense" },
                  { key: "ivHp", label: "HP" }
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs font-semibold w-16 text-slate-300">{label}:</span>
                    <input
                      type="range"
                      min="0"
                      max="15"
                      value={formData[key]}
                      onChange={(e) => setFormData({ ...formData, [key]: Number(e.target.value) })}
                      className="flex-1 accent-amber-500"
                    />
                    <span className="text-xs font-mono font-bold w-6 text-right">{formData[key]}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Fast Move</label>
                  <input
                    type="text"
                    placeholder="e.g. Powder Snow"
                    value={formData.fastMove}
                    onChange={(e) => setFormData({ ...formData, fastMove: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Charged Move</label>
                  <input
                    type="text"
                    placeholder="e.g. Avalanche"
                    value={formData.chargedMove}
                    onChange={(e) => setFormData({ ...formData, chargedMove: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-lg shadow transition"
              >
                Save to My Box
              </button>
            </form>
          </div>
        )}

        {activeTab === "inventory" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">My Pokémon Box ({inventory.length})</h2>
              <button
                onClick={() => setActiveTab("add")}
                className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 rounded-lg"
              >
                + Add / Scan Another
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inventory.map((p) => {
                const totalIV = p.ivAtk + p.ivDef + p.ivHp;
                const ivPercent = Math.round((totalIV / 45) * 100);

                return (
                  <div key={p.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-xs text-amber-400 font-bold">{p.form}</span>
                          <h3 className="font-bold text-lg">{p.name}</h3>
                        </div>
                        <span className="text-sm font-mono font-extrabold text-slate-300">CP {p.cp}</span>
                      </div>

                      <div className="text-xs text-slate-400 space-y-1 my-3 bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/50">
                        <div>⚔️ Fast: <span className="text-slate-200">{p.fastMove || "Not Set"}</span></div>
                        <div>💥 Charged: <span className="text-slate-200">{p.chargedMove || "Not Set"}</span></div>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">IV: {p.ivAtk}/{p.ivDef}/{p.ivHp}</span>
                        <span className={`font-bold ${ivPercent === 100 ? "text-amber-400" : "text-emerald-400"}`}>
                          {ivPercent}% {ivPercent === 100 ? "★ 4★ (Hundo)" : totalIV >= 37 ? "★ 3★" : ""}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => removePokemon(p.id)}
                      className="mt-4 text-xs text-rose-400 hover:text-rose-300 text-right w-full"
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
