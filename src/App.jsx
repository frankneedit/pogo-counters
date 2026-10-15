import React, { useState, useEffect } from 'react';
import { 
  Upload, Search, Shield, Zap, Sparkles, Trash2, 
  RefreshCw, X, Layers, Image as ImageIcon, Download, UploadCloud, Plus
} from 'lucide-react';
import { createWorker } from 'tesseract.js';

const DB_NAME = 'PokeGoVaultDB';
const DB_VERSION = 1;
const STORE_NAME = 'pokemon_records';

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveRecord = async (record) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const getAllRecords = async () => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
};

const deleteRecord = async (id) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export default function App() {
  const [records, setRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTag, setFilterTag] = useState('ALL');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [activeRecord, setActiveRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inspectedImage, setInspectedImage] = useState(null);
  const [debugCropUrl, setDebugCropUrl] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const data = await getAllRecords();
    setRecords(data.sort((a, b) => b.createdAt - a.createdAt));
  };

  const rgbToHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return [h * 360, s * 100, l * 100];
  };

  // 1. Calibrated IV Bar Analyzer
  const analyzeIVBars = (canvas) => {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // Fully calibrated inner track boundaries for 20:9 displays
    const startX = Math.round(W * 0.115);
    const endX = Math.round(W * 0.468);
    const totalBarWidth = endX - startX;

    const barYPercentages = [0.776, 0.822, 0.864];

    const ivs = barYPercentages.map((yPct) => {
      const yCenter = Math.round(H * yPct);
      let filledPixels = 0;
      const offsets = [-3, -1, 0, 1, 3];

      for (let x = startX; x <= endX; x++) {
        let isFilled = false;
        for (let dy of offsets) {
          const pixel = ctx.getImageData(x, yCenter + dy, 1, 1).data;
          const [r, g, b] = [pixel[0], pixel[1], pixel[2]];
          const [h, s, l] = rgbToHsl(r, g, b);

          const isOrange = (h >= 16 && h <= 55 && s >= 30 && l >= 25 && l <= 80);
          const isCoralRedByRGB = (r > 175 && r > g + 30 && r > b + 30 && l <= 85);
          const isCoralRedByHSL = ((h >= 335 || h <= 20) && s >= 25 && l >= 30 && l <= 82);

          if (isOrange || isCoralRedByRGB || isCoralRedByHSL) {
            isFilled = true;
            break;
          }
        }
        if (isFilled) filledPixels++;
      }

      const ratio = Math.min(1, Math.max(0, filledPixels / totalBarWidth));
      // Exactly 15 units divided across 3 tick segments
      return Math.min(15, Math.max(0, Math.round(ratio * 15)));
    });

    return {
      atk: ivs[0] ?? 0,
      def: ivs[1] ?? 0,
      hp: ivs[2] ?? 0
    };
  };

  // 2. Dynamic Moveset Reader (Locates the tab header first)
  const extractMovesFromCanvas = async (worker, canvas) => {
    // Crop the entire lower 40% where attacks can reside (Mega/Primal shifts included)
    const mW = Math.round(canvas.width * 0.88);
    const mH = Math.round(canvas.height * 0.35);
    const moveCanvas = document.createElement('canvas');
    moveCanvas.width = mW;
    moveCanvas.height = mH;
    moveCanvas.getContext('2d').drawImage(
      canvas,
      Math.round(canvas.width * 0.06),
      Math.round(canvas.height * 0.65),
      mW, mH, 0, 0, mW, mH
    );

    const moveRes = await worker.recognize(moveCanvas);
    const rawLines = moveRes.data.lines.map(l => l.text.trim());

    // Find the line index where "GYMS" or "RAIDS" appears
    let tabIndex = rawLines.findIndex(t => {
      const up = t.toUpperCase();
      return up.includes('GYM') || up.includes('RAID') || up.includes('TRAINER');
    });

    // If tab header is found, scan lines starting immediately below it
    const candidateLines = (tabIndex !== -1 ? rawLines.slice(tabIndex + 1) : rawLines)
      .map(t => {
        // Remove trailing move power numbers, type icons, or single stray letters (like "140", "H", "I")
        return t.replace(/\d+/g, '').replace(/[^a-zA-Z\s]/g, '').trim();
      })
      .filter(t => {
        const up = t.toUpperCase();
        return (
          t.length >= 3 &&
          !up.includes('GYM') &&
          !up.includes('RAID') &&
          !up.includes('TRAINER') &&
          !up.includes('BATTLE') &&
          !up.includes('STARDUST') &&
          !up.includes('CANDY') &&
          !up.includes('POWER') &&
          !up.includes('NEW ATTACK') &&
          !up.includes('PRIMAL') &&
          !up.includes('REVERSION')
        );
      });

    return {
      fast: candidateLines[0] || '',
      charged: candidateLines[1] || ''
    };
  };
  const handleFilesSelected = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setIsProcessing(true);

    const files = Array.from(fileList);
    setStatusMsg(`Loading ${files.length} screenshot(s)...`);

    let current = activeRecord ? { ...activeRecord } : {
      id: 'poke_' + Date.now(),
      name: '',
      cp: 0,
      atk: 0,
      def: 0,
      hp: 0,
      ivPercentage: 0,
      fastMove: '',
      chargedMove: '',
      tags: [],
      screenshot: '',
      createdAt: Date.now()
    };

    try {
      const worker = await createWorker('eng');

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setStatusMsg(`Analyzing screenshot ${i + 1} of ${files.length}...`);

        const img = new Image();
        const dataUrl = await new Promise((res) => {
          const reader = new FileReader();
          reader.onload = (e) => res(e.target.result);
          reader.readAsDataURL(file);
        });
        img.src = dataUrl;
        await new Promise((res) => (img.onload = res));

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const ivs = analyzeIVBars(canvas);
        const hasAppraisalCard = (ivs.atk > 0 || ivs.def > 0 || ivs.hp > 0);

        if (hasAppraisalCard) {
          setStatusMsg('Reading IVs, Species & CP...');

          const cpCanvas = document.createElement('canvas');
          const cpW = Math.round(canvas.width * 0.45);
          const cpH = Math.round(canvas.height * 0.08);
          cpCanvas.width = cpW;
          cpCanvas.height = cpH;
          cpCanvas.getContext('2d').drawImage(
            canvas,
            Math.round(canvas.width * 0.28),
            Math.round(canvas.height * 0.045),
            cpW, cpH, 0, 0, cpW, cpH
          );
          const cpRes = await worker.recognize(cpCanvas);
          const cpMatch = cpRes.data.text.match(/\d{3,4}/);

          const nameCanvas = document.createElement('canvas');
          const nW = Math.round(canvas.width * 0.6);
          const nH = Math.round(canvas.height * 0.06);
          nameCanvas.width = nW;
          nameCanvas.height = nH;
          nameCanvas.getContext('2d').drawImage(
            canvas,
            Math.round(canvas.width * 0.2),
            Math.round(canvas.height * 0.38),
            nW, nH, 0, 0, nW, nH
          );
          const nameRes = await worker.recognize(nameCanvas);
          const cleanName = nameRes.data.text.replace(/[^a-zA-Z]/g, '').trim();

          const dW = Math.round(canvas.width * 0.40);
          const dH = Math.round(canvas.height * 0.14);
          const debugCanvas = document.createElement('canvas');
          debugCanvas.width = dW;
          debugCanvas.height = dH;
          debugCanvas.getContext('2d').drawImage(
            canvas,
            Math.round(canvas.width * 0.10),
            Math.round(canvas.height * 0.75),
            dW, dH, 0, 0, dW, dH
          );
          setDebugCropUrl(debugCanvas.toDataURL());

          const totalIv = ivs.atk + ivs.def + ivs.hp;
          const ivPct = parseFloat(((totalIv / 45) * 100).toFixed(1));

          current.atk = ivs.atk;
          current.def = ivs.def;
          current.hp = ivs.hp;
          current.ivPercentage = ivPct;
          if (cleanName.length >= 3) current.name = cleanName;
          if (cpMatch) current.cp = parseInt(cpMatch[0], 10);
          current.screenshot = dataUrl;
        } else {
          setStatusMsg('Reading Moveset...');
          const moves = await extractMovesFromCanvas(worker, canvas);
          if (moves.fast) current.fastMove = moves.fast;
          if (moves.charged) current.chargedMove = moves.charged;
          if (!current.screenshot) current.screenshot = dataUrl;
        }
      }

      if (!current.name) current.name = 'Pokémon';
      const tags = [];
      if (current.atk + current.def + current.hp === 45) tags.push('Hundo (100%)');
      if (current.cp <= 1500) tags.push('Great League');
      else if (current.cp <= 2500) tags.push('Ultra League');
      else tags.push('Master League');
      current.tags = tags;

      await worker.terminate();
      setActiveRecord(current);
      setIsModalOpen(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
      setStatusMsg('');
    }
  };

  const handleSaveModal = async () => {
    if (!activeRecord) return;
    await saveRecord(activeRecord);
    await loadAll();
    setIsModalOpen(false);
    setActiveRecord(null);
    setDebugCropUrl(null);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (confirm('Delete this record?')) {
      await deleteRecord(id);
      loadAll();
    }
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pokevault_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const importJSON = (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const list = JSON.parse(e.target.result);
        if (Array.isArray(list)) {
          for (let item of list) {
            await saveRecord(item);
          }
          await loadAll();
          alert('Import completed successfully!');
        }
      } catch (err) {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
  };

  const filteredRecords = records.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.fastMove.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.chargedMove.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.cp.toString().includes(searchTerm);
    const matchesTag = filterTag === 'ALL' || r.tags.includes(filterTag);
    return matchesSearch && matchesTag;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16 font-sans">
      <header className="border-b border-slate-800 bg-slate-900/80 sticky top-0 z-30 backdrop-blur-md px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-400 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">PokéVault</h1>
              <p className="text-xs text-slate-400">Appraisal & Moveset Scanner</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={exportJSON}
              title="Export JSON Backup"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <label 
              title="Import JSON Backup"
              className="cursor-pointer p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5"
            >
              <UploadCloud className="w-4 h-4" />
              <span className="hidden sm:inline">Import</span>
              <input type="file" accept=".json" className="hidden" onChange={(e) => e.target.files?.[0] && importJSON(e.target.files[0])} />
            </label>
            <label className="cursor-pointer flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 px-4 py-2 rounded-xl text-sm font-semibold shadow-md active:scale-95 transition-all">
              <Upload className="w-4 h-4" />
              <span>Scan Screenshot(s)</span>
              <input 
                type="file" 
                accept="image/*" 
                multiple
                className="hidden" 
                onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
              />
            </label>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-6">
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input 
              type="text"
              placeholder="Search by Pokémon name, CP, or Moveset..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            {['ALL', 'Hundo (100%)', 'Great League', 'Ultra League', 'Master League'].map(tag => (
              <button
                key={tag}
                onClick={() => setFilterTag(tag)}
                className={`px-3 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  filterTag === tag 
                    ? 'bg-cyan-500 text-slate-950 font-bold' 
                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {isProcessing && (
          <div className="mb-6 p-4 rounded-xl bg-cyan-950/40 border border-cyan-800/50 flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
            <p className="text-sm font-medium text-cyan-200">{statusMsg}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecords.map((item) => (
            <div 
              key={item.id}
              className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-extrabold text-lg text-slate-100 tracking-wide">
                      {item.name} - CP {item.cp}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {item.ivPercentage}% IV
                      </span>
                      <span className="text-xs text-slate-400">
                        ({item.atk}/{item.def}/{item.hp})
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => handleDelete(item.id, e)}
                    className="text-slate-500 hover:text-rose-400 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1.5 my-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/50">
                  {['ATK', 'DEF', 'HP'].map((stat, idx) => {
                    const val = idx === 0 ? item.atk : idx === 1 ? item.def : item.hp;
                    const isMax = val === 15;
                    return (
                      <div key={stat} className="flex items-center gap-2 text-xs">
                        <span className="w-7 font-bold text-slate-400">{stat}</span>
                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden flex gap-0.5">
                          <div 
                            className={`h-full transition-all ${
                              isMax ? 'bg-rose-500 shadow-sm shadow-rose-500/50' : 'bg-amber-400'
                            }`}
                            style={{ width: `${(val / 15) * 100}%` }}
                          />
                        </div>
                        <span className="w-5 text-right font-bold text-slate-300">{val}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-1 text-xs mt-3">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="font-semibold text-slate-400">Fast:</span>
                    <span>{item.fastMove || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Shield className="w-3.5 h-3.5 text-rose-400" />
                    <span className="font-semibold text-slate-400">Charged:</span>
                    <span>{item.chargedMove || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {item.tags.map(t => (
                    <span key={t} className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                      {t}
                    </span>
                  ))}
                </div>
                {item.screenshot && (
                  <button
                    onClick={() => setInspectedImage(item.screenshot)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
                  >
                    <ImageIcon className="w-3 h-3" /> View Pic
                  </button>
                )}
              </div>
            </div>
          ))}

          {filteredRecords.length === 0 && !isProcessing && (
            <div className="col-span-full py-16 text-center text-slate-500">
              <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No Pokémon recorded yet. Select one or both screenshots above to scan.</p>
            </div>
          )}
        </div>
      </main>

      {isModalOpen && activeRecord && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Verify Scanned Appraisal</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {debugCropUrl && (
              <div className="mb-4 bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <p className="text-[11px] text-slate-400 mb-2">Detected Appraisal Card Region:</p>
                <img src={debugCropUrl} alt="Bar Region" className="h-16 mx-auto rounded border border-slate-700 object-contain" />
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Species Name</label>
                  <input
                    type="text"
                    value={activeRecord.name}
                    onChange={(e) => setActiveRecord({ ...activeRecord, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Combat Power (CP)</label>
                  <input
                    type="number"
                    value={activeRecord.cp}
                    onChange={(e) => setActiveRecord({ ...activeRecord, cp: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                  />
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl space-y-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-slate-300">IV Stats (0 - 15)</span>
                  <span className="text-xs font-bold text-amber-400">
                    {activeRecord.ivPercentage}% ({activeRecord.atk + activeRecord.def + activeRecord.hp}/45)
                  </span>
                </div>
                {['atk', 'def', 'hp'].map((stat) => (
                  <div key={stat} className="flex items-center gap-3">
                    <span className="w-10 text-xs font-bold uppercase text-slate-400">{stat}</span>
                    <input
                      type="range"
                      min="0"
                      max="15"
                      value={activeRecord[stat]}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        const updated = { ...activeRecord, [stat]: val };
                        const total = updated.atk + updated.def + updated.hp;
                        updated.ivPercentage = parseFloat(((total / 45) * 100).toFixed(1));
                        setActiveRecord(updated);
                      }}
                      className="flex-1 accent-amber-400 cursor-pointer"
                    />
                    <span className="w-6 text-right font-bold text-sm text-slate-200">{activeRecord[stat]}</span>
                  </div>
                ))}
              </div>

              <div className="bg-slate-950 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-300">Moveset</span>
                  <label className="cursor-pointer text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Attach Moveset Pic</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFilesSelected([e.target.files[0]])}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Fast Attack</label>
                    <input
                      type="text"
                      value={activeRecord.fastMove}
                      placeholder="e.g. Metal Claw"
                      onChange={(e) => setActiveRecord({ ...activeRecord, fastMove: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Charged Attack</label>
                    <input
                      type="text"
                      value={activeRecord.chargedMove}
                      placeholder="e.g. Draco Meteor"
                      onChange={(e) => setActiveRecord({ ...activeRecord, chargedMove: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveModal}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-bold"
              >
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {inspectedImage && (
        <div 
          onClick={() => setInspectedImage(null)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
        >
          <img src={inspectedImage} alt="Full screenshot" className="max-h-[90vh] rounded-lg shadow-2xl object-contain" />
        </div>
      )}
    </div>
  );
}
