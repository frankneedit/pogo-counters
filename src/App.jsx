import React, { useState, useEffect } from 'react';
import { createWorker } from 'tesseract.js';

// Pre-compiled comprehensive move list to guarantee recognition
const OFFICIAL_MOVES = [
  // Fast Moves
  "Charm", "Counter", "Dragon Breath", "Dragon Tail", "Fast Attack",
  "Fury Cutter", "Ice Shard", "Incinerate", "Lick", "Lock-On",
  "Mud Shot", "Mud-Slap", "Poison Jab", "Powder Snow", "Psycho Cut",
  "Quick Attack", "Rock Throw", "Scratch", "Shadow Claw", "Smack Down",
  "Snarl", "Spark", "Tackle", "Thunder Shock", "Vine Whip",
  "Volt Switch", "Water Gun", "Waterfall", "Wing Attack", "Zen Headbutt",

  // Charged Moves
  "Acrobatics", "Aerial Ace", "Ancient Power", "Aura Sphere", "Avalanche",
  "Blizzard", "Body Slam", "Brave Bird", "Brutal Swing", "Bulldoze",
  "Close Combat", "Crabhammer", "Cross Chop", "Crunch", "Dark Pulse",
  "Dazzling Gleam", "Discharge", "Doom Desire", "Draco Meteor", "Dragon Claw",
  "Dragon Pulse", "Dynamic Punch", "Earth Power", "Earthquake", "Energy Ball",
  "Flamethrower", "Flash Cannon", "Flying Press", "Focus Blast", "Foul Play",
  "Frenzy Plant", "Giga Impact", "Grass Knot", "Gunk Shot", "Gyro Ball",
  "Heavy Slam", "High Horsepower", "Horn Attack", "Hurricane", "Hydro Cannon",
  "Hydro Pump", "Hyper Beam", "Hyper Fang", "Ice Beam", "Ice Punch",
  "Icicle Spear", "Iron Head", "Leaf Blade", "Leaf Storm", "Liquidation",
  "Lunge", "Magma Storm", "Megahorn", "Meteor Mash", "Moonblast",
  "Muddy Water", "Mystical Fire", "Night Slash", "Origin Pulse", "Outrage",
  "Overheat", "Play Rough", "Poltergeist", "Power Gem", "Power Whip",
  "Precipice Blades", "Psychic", "Psychic Fangs", "Psystrike", "Rock Blast",
  "Rock Slide", "Rock Wrecker", "Sacred Fire", "Sacred Sword", "Sand Tomb",
  "Scald", "Scorching Sands", "Seed Bomb", "Shadow Ball", "Shadow Bone",
  "Shadow Punch", "Shadow Sneak", "Signal Beam", "Silver Wind", "Sky Attack",
  "Sludge Bomb", "Sludge Wave", "Solar Beam", "Spacious Rend", "Stone Edge",
  "Superpower", "Surf", "Swift", "Synchronoise", "Techno Blast",
  "Thunder", "Thunder Punch", "Thunderbolt", "Tri Attack", "Twister",
  "V-create", "Weather Ball", "Wild Charge", "X-Scissor", "Zap Cannon"
];

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h = Math.round(h * 60);
  }
  return [h, Math.round(s * 100), Math.round(l * 100)];
}

export default function App() {
  const [records, setRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTag, setFilterTag] = useState('ALL');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [activeRecord, setActiveRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailsRecord, setDetailsRecord] = useState(null);
  const [inspectedImage, setInspectedImage] = useState(null);
  const [debugCropUrl, setDebugCropUrl] = useState(null);

  // Load saved Pokémon from localStorage on boot
  useEffect(() => {
    const saved = localStorage.getItem('pogo_scanned_roster');
    if (saved) {
      try {
        setRecords(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved records:", e);
      }
    }
  }, []);

  const saveRecord = (recordToSave) => {
    const updated = [recordToSave, ...records.filter(r => r.id !== recordToSave.id)];
    setRecords(updated);
    localStorage.setItem('pogo_scanned_roster', JSON.stringify(updated));
    setIsModalOpen(false);
    setActiveRecord(null);
  };

  const deleteRecord = (id) => {
    const updated = records.filter(r => r.id !== id);
    setRecords(updated);
    localStorage.setItem('pogo_scanned_roster', JSON.stringify(updated));
  };

  // --- SCREEN DETECTION ---
  const checkIfAppraisalScreen = (canvas) => {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // Check 1: Look for the Green "POWER UP" button that exists ONLY on moveset/profile screen
    // Located roughly X: 12% - 40%, Y: 48% - 62%
    let greenButtonPixels = 0;
    for (let x = Math.round(W * 0.12); x <= Math.round(W * 0.38); x += 8) {
      for (let y = Math.round(H * 0.48); y <= Math.round(H * 0.62); y += 6) {
        const p = ctx.getImageData(x, y, 1, 1).data;
        const [h, s, l] = rgbToHsl(p[0], p[1], p[2]);
        if (h >= 115 && h <= 170 && s >= 30 && l >= 30 && l <= 85) {
          greenButtonPixels++;
        }
      }
    }

    if (greenButtonPixels >= 8) {
      return false; // Found green button -> Moveset Screen!
    }

    // Check 2: The appraisal screen ALWAYS has the pure white dialogue bubble at the very bottom
    let whiteBubblePixels = 0;
    const probeX = Math.round(W * 0.50);
    for (let y = Math.round(H * 0.90); y <= Math.round(H * 0.96); y += 2) {
      const p = ctx.getImageData(probeX, y, 1, 1).data;
      if (p[0] >= 235 && p[1] >= 235 && p[2] >= 235) {
        whiteBubblePixels++;
      }
    }

    return whiteBubblePixels >= 8;
  };

  // --- UNIVERSAL IV BAR ANALYZER ---
  const analyzeIVBars = (canvas) => {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // 1. Locate the top edge of the white dialogue speech bubble at bottom center
    const probeX = Math.round(W * 0.50);
    let bubbleTopY = -1;

    for (let y = Math.round(H * 0.88); y >= Math.round(H * 0.75); y -= 2) {
      const p = ctx.getImageData(probeX, y, 1, 1).data;
      if (p[0] < 220 || p[1] < 220 || p[2] < 220) {
        bubbleTopY = y;
        break;
      }
    }

    if (bubbleTopY === -1) {
      bubbleTopY = Math.round(H * 0.89);
    }

    // Fixed relative vertical positions of the 3 stat bars above the dialogue bubble
    const barCenters = [
      bubbleTopY - Math.round(H * 0.138), // Attack bar
      bubbleTopY - Math.round(H * 0.095), // Defense bar
      bubbleTopY - Math.round(H * 0.052)  // HP bar
    ];

    const startX = Math.round(W * 0.118);
    const endX = Math.round(W * 0.458);
    const totalBarWidth = endX - startX;

    const isCoralRed = (r, g, b) => {
      // Maxed 15-bar color in Pokémon GO: strong red, muted green/blue
      return r > 185 && g < 130 && b < 140 && (r - g > 50);
    };

    const isOrange = (r, g, b) => {
      const [h, s, l] = rgbToHsl(r, g, b);
      return h >= 14 && h <= 55 && s >= 25 && l >= 25 && l <= 85;
    };

    const ivs = barCenters.map((yCenter) => {
      const vOffsets = [-5, -3, -1, 0, 1, 3, 5];

      // A. Check for RED -> Immediate 15
      let redCount = 0;
      for (let x = startX; x <= endX; x += 2) {
        for (let dy of vOffsets) {
          const [r, g, b] = ctx.getImageData(x, yCenter + dy, 1, 1).data;
          if (isCoralRed(r, g, b)) {
            redCount++;
            break;
          }
        }
      }

      if (redCount >= totalBarWidth * 0.15) {
        return 15;
      }

      // B. Check if right tip is filled (100% capacity) -> Immediate 15
      let rightTipFilled = false;
      for (let dy of vOffsets) {
        const [r, g, b] = ctx.getImageData(endX - 3, yCenter + dy, 1, 1).data;
        if (isOrange(r, g, b) || isCoralRed(r, g, b)) {
          rightTipFilled = true;
          break;
        }
      }

      if (rightTipFilled) {
        return 15;
      }

      // C. Count filled pixels from left to right (0 - 14)
      let filledPixels = 0;
      for (let x = startX; x <= endX; x++) {
        let isFilled = false;
        for (let dy of vOffsets) {
          const [r, g, b] = ctx.getImageData(x, yCenter + dy, 1, 1).data;
          if (isOrange(r, g, b) || isCoralRed(r, g, b)) {
            isFilled = true;
            break;
          }
        }
        if (isFilled) filledPixels++;
      }

      const ratio = Math.min(1, Math.max(0, filledPixels / totalBarWidth));
      return Math.min(14, Math.max(0, Math.round(ratio * 15)));
    });

    const cropTop = barCenters[0] - Math.round(H * 0.035);

    return {
      atk: ivs[0] ?? 0,
      def: ivs[1] ?? 0,
      hp: ivs[2] ?? 0,
      debugCardBox: {
        x: Math.round(W * 0.07),
        y: cropTop,
        w: Math.round(W * 0.44),
        h: Math.round(H * 0.15)
      }
    };
  };

  // --- MOVESET EXTRACTOR ---
  const extractMovesFromCanvas = async (worker, canvas) => {
    // Crop strictly the left half (X: 12% to 65%) where move text sits,
    // avoiding the energy bars and damage numbers on the right
    const cropX = Math.round(canvas.width * 0.12);
    const cropW = Math.round(canvas.width * 0.52);
    const cropY = Math.round(canvas.height * 0.52);
    const cropH = Math.round(canvas.height * 0.38);

    const moveCanvas = document.createElement('canvas');
    moveCanvas.width = cropW;
    moveCanvas.height = cropH;
    moveCanvas.getContext('2d').drawImage(
      canvas,
      cropX, cropY, cropW, cropH,
      0, 0, cropW, cropH
    );

    const moveRes = await worker.recognize(moveCanvas);
    const rawLines = (moveRes.data.text || '').split('\n').map(l => l.trim()).filter(Boolean);

    const candidates = [];
    for (let line of rawLines) {
      const up = line.toUpperCase();
      if (
        line.length < 3 ||
        up.includes('GYMS') ||
        up.includes('RAIDS') ||
        up.includes('TRAINER') ||
        up.includes('POWER UP') ||
        up.includes('MEGA') ||
        up.includes('EVOLVE') ||
        up.includes('WEATHER') ||
        up.includes('BONUS') ||
        up.includes('MAX') ||
        up.includes('STARDUST') ||
        up.includes('CANDY') ||
        up.includes('WEIGHT') ||
        up.includes('HEIGHT')
      ) {
        continue;
      }

      const cleaned = line.replace(/NEW ATTACK/gi, '').replace(/\d+/g, '').replace(/[^a-zA-Z\s]/g, '').trim();
      if (cleaned.length >= 3) {
        candidates.push(cleaned.toLowerCase());
      }
    }

    const recognized = [];
    const sortedOfficial = [...OFFICIAL_MOVES].sort((a, b) => b.length - a.length);

    for (let c of candidates) {
      for (let move of sortedOfficial) {
        const mLow = move.toLowerCase();
        if (c.includes(mLow) || mLow.includes(c)) {
          if (!recognized.includes(move)) {
            recognized.push(move);
          }
          break;
        }
      }
    }

    return {
      fast: recognized[0] || '',
      charged: recognized.slice(1).join(' / ')
    };
  };

  // --- FILE SELECTION PIPELINE ---
  const handleFilesSelected = async (eventOrFiles) => {
    let fileList = [];
    if (eventOrFiles instanceof FileList || Array.isArray(eventOrFiles)) {
      fileList = Array.from(eventOrFiles);
    } else if (eventOrFiles?.target?.files) {
      fileList = Array.from(eventOrFiles.target.files);
    } else if (eventOrFiles?.dataTransfer?.files) {
      fileList = Array.from(eventOrFiles.dataTransfer.files);
    }

    if (!fileList || fileList.length === 0) return;

    setIsProcessing(true);
    setStatusMsg("Loading screenshots...");

    try {
      const worker = await createWorker('eng');

      // 1. Preload canvases
      const loaded = await Promise.all(
        fileList.map((file) => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                const isAppraisal = checkIfAppraisalScreen(canvas);
                resolve({ canvas, dataUrl: ev.target.result, isAppraisal });
              };
              img.onerror = reject;
              img.src = ev.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        })
      );

      // 2. Sort: Appraisal screen ALWAYS processed first
      loaded.sort((a, b) => (b.isAppraisal ? 1 : 0) - (a.isAppraisal ? 1 : 0));

      // Reset record state for new scan
      let current = {
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
        types: [],
        screenshot: '',
        createdAt: Date.now()
      };

      for (let i = 0; i < loaded.length; i++) {
        const { canvas, dataUrl, isAppraisal } = loaded[i];

        if (isAppraisal) {
          setStatusMsg(`Analyzing Appraisal Screen (${i + 1}/${loaded.length})...`);
          const ivs = analyzeIVBars(canvas);

          // CP Detection (at the top: CP XXXX)
          const cpCanvas = document.createElement('canvas');
          const cpW = Math.round(canvas.width * 0.45);
          const cpH = Math.round(canvas.height * 0.08);
          cpCanvas.width = cpW;
          cpCanvas.height = cpH;
          cpCanvas.getContext('2d').drawImage(
            canvas,
            Math.round(canvas.width * 0.28), Math.round(canvas.height * 0.045),
            cpW, cpH, 0, 0, cpW, cpH
          );
          const cpRes = await worker.recognize(cpCanvas);
          const cpMatch = cpRes.data.text.match(/\d{3,4}/);

          // Name Detection (on the white card: e.g. Gardevoir, Mewtwo)
          const nameCanvas = document.createElement('canvas');
          const nW = Math.round(canvas.width * 0.60);
          const nH = Math.round(canvas.height * 0.06);
          nameCanvas.width = nW;
          nameCanvas.height = nH;
          nameCanvas.getContext('2d').drawImage(
            canvas,
            Math.round(canvas.width * 0.20), Math.round(canvas.height * 0.38),
            nW, nH, 0, 0, nW, nH
          );
          const nameRes = await worker.recognize(nameCanvas);
          const cleanName = nameRes.data.text.replace(/[^a-zA-Z]/g, '').trim();

          // Generate crop preview for user verification
          if (ivs.debugCardBox) {
            const box = ivs.debugCardBox;
            const debugCanvas = document.createElement('canvas');
            debugCanvas.width = box.w;
            debugCanvas.height = box.h;
            debugCanvas.getContext('2d').drawImage(
              canvas,
              box.x, box.y, box.w, box.h,
              0, 0, box.w, box.h
            );
            setDebugCropUrl(debugCanvas.toDataURL());
          }

          const totalIv = ivs.atk + ivs.def + ivs.hp;
          current.atk = ivs.atk;
          current.def = ivs.def;
          current.hp = ivs.hp;
          current.ivPercentage = parseFloat(((totalIv / 45) * 100).toFixed(1));
          if (cleanName.length >= 3) current.name = cleanName;
          if (cpMatch) current.cp = parseInt(cpMatch[0], 10);
          current.screenshot = dataUrl;
        } else {
          // Moveset Screen
          setStatusMsg(`Analyzing Moveset Screen (${i + 1}/${loaded.length})...`);
          const moves = await extractMovesFromCanvas(worker, canvas);
          if (moves.fast) current.fastMove = moves.fast;
          if (moves.charged) current.chargedMove = moves.charged;
        }
      }

      await worker.terminate();

      setActiveRecord(current);
      setIsModalOpen(true);
    } catch (err) {
      console.error("Scan failed:", err);
      alert("Error scanning image: " + (err.message || err));
    } finally {
      setIsProcessing(false);
      setStatusMsg("");
      if (eventOrFiles?.target) {
        eventOrFiles.target.value = "";
      }
    }
  };

  const filteredRecords = records.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag = filterTag === 'ALL' || (r.tags && r.tags.includes(filterTag));
    return matchesSearch && matchesTag;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 max-w-4xl mx-auto pb-24">
      {/* Header */}
      <header className="flex justify-between items-center py-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-cyan-400"></span>
            PokéVault Scanner
          </h1>
          <p className="text-xs text-slate-400">Universal Pokémon GO IV & Moveset Analyzer</p>
        </div>
        <label className="cursor-pointer bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-sm transition shadow-lg shadow-cyan-500/20 active:scale-95 inline-flex items-center gap-2">
          <span>+ Scan Screenshots</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFilesSelected}
          />
        </label>
      </header>

      {/* Status Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-sm font-medium text-cyan-200">{statusMsg || "Processing..."}</p>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="mt-6 flex flex-wrap gap-2 items-center justify-between">
        <input
          type="text"
          placeholder="Search by Pokémon name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-100 flex-1 min-w-[200px] focus:outline-none focus:border-cyan-500"
        />
        <div className="flex gap-1 overflow-x-auto py-1">
          {['ALL', 'HUNDO', 'RAID', 'GYM', 'PVP'].map((tag) => (
            <button
              key={tag}
              onClick={() => setFilterTag(tag)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filterTag === tag
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Pokémon Card Grid */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filteredRecords.map((item) => (
          <div
            key={item.id}
            onClick={() => setDetailsRecord(item)}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex gap-4 cursor-pointer hover:border-slate-700 transition"
          >
            {item.screenshot ? (
              <img
                src={item.screenshot}
                alt={item.name}
                className="w-20 h-20 object-cover rounded-xl border border-slate-800 bg-slate-950"
              />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-slate-950 flex items-center justify-center text-xs text-slate-500">
                No Img
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-base truncate text-white">{item.name || "Unknown"}</h3>
                <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                  CP {item.cp}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-xl font-black text-amber-400">{item.ivPercentage}%</span>
                <span className="text-xs font-mono text-slate-400">
                  {item.atk}/{item.def}/{item.hp}
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-400 truncate">
                ⚔️ {item.fastMove || '—'} | 💥 {item.chargedMove || '—'}
              </div>
            </div>
          </div>
        ))}
        {filteredRecords.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-500 text-sm">
            No Pokémon saved yet. Click "+ Scan Screenshots" above to import!
          </div>
        )}
      </div>

      {/* Verify Scanned Appraisal Modal */}
      {isModalOpen && activeRecord && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">Verify Scanned Appraisal</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {/* Debug Crop Preview */}
            {debugCropUrl && (
              <div className="mt-4 flex flex-col items-center">
                <p className="text-xs text-slate-400 mb-2">Detected Appraisal Card Region:</p>
                <img
                  src={debugCropUrl}
                  alt="Cropped IV Card"
                  className="rounded-lg border border-slate-700 max-h-24 object-contain shadow-md"
                />
              </div>
            )}

            {/* Editable Fields */}
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Species Name</label>
                  <input
                    type="text"
                    value={activeRecord.name}
                    onChange={(e) => setActiveRecord({ ...activeRecord, name: e.target.value })}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Combat Power (CP)</label>
                  <input
                    type="number"
                    value={activeRecord.cp}
                    onChange={(e) => setActiveRecord({ ...activeRecord, cp: parseInt(e.target.value, 10) || 0 })}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              {/* Sliders for IV verification */}
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-300">IV Stats (0 - 15)</span>
                  <span className="text-sm font-black text-amber-400">
                    {activeRecord.ivPercentage}% ({activeRecord.atk + activeRecord.def + activeRecord.hp}/45)
                  </span>
                </div>

                {['atk', 'def', 'hp'].map((stat) => (
                  <div key={stat} className="flex items-center gap-3 my-2">
                    <span className="text-xs uppercase w-8 font-bold text-slate-400">{stat}</span>
                    <input
                      type="range"
                      min="0"
                      max="15"
                      value={activeRecord[stat]}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        const next = { ...activeRecord, [stat]: val };
                        next.ivPercentage = parseFloat((((next.atk + next.def + next.hp) / 45) * 100).toFixed(1));
                        setActiveRecord(next);
                      }}
                      className="flex-1 accent-amber-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <span className="w-6 text-right font-mono font-bold text-sm text-white">{activeRecord[stat]}</span>
                  </div>
                ))}
              </div>

              {/* Moveset */}
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-300">Moveset</span>
                  <label className="text-xs text-cyan-400 hover:underline cursor-pointer">
                    + Attach Moveset Pic
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFilesSelected}
                    />
                  </label>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400">Fast Attack</label>
                    <input
                      type="text"
                      placeholder="e.g. Charm"
                      value={activeRecord.fastMove}
                      onChange={(e) => setActiveRecord({ ...activeRecord, fastMove: e.target.value })}
                      className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Charged Attack</label>
                    <input
                      type="text"
                      placeholder="e.g. Dazzling Gleam / Shadow Ball"
                      value={activeRecord.chargedMove}
                      onChange={(e) => setActiveRecord({ ...activeRecord, chargedMove: e.target.value })}
                      className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-xl text-sm transition"
              >
                Cancel
              </button>
              <button
                onClick={() => saveRecord(activeRecord)}
                className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-3 rounded-xl text-sm transition shadow-lg shadow-cyan-500/20 active:scale-95"
              >
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details / Inspection Modal */}
      {detailsRecord && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">{detailsRecord.name} Details</h2>
              <button onClick={() => setDetailsRecord(null)} className="text-slate-400 hover:text-white text-xl font-bold">
                ✕
              </button>
            </div>

            {detailsRecord.screenshot && (
              <div className="mt-4 flex justify-center">
                <img
                  src={detailsRecord.screenshot}
                  alt={detailsRecord.name}
                  onClick={() => setInspectedImage(detailsRecord.screenshot)}
                  className="rounded-2xl max-h-64 object-contain border border-slate-800 cursor-zoom-in"
                />
              </div>
            )}

            <div className="mt-4 space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-400 text-sm">Combat Power</span>
                <span className="font-bold text-white text-sm">CP {detailsRecord.cp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-sm">IV Total</span>
                <span className="font-bold text-amber-400 text-sm">
                  {detailsRecord.ivPercentage}% ({detailsRecord.atk}/{detailsRecord.def}/{detailsRecord.hp})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-sm">Fast Attack</span>
                <span className="font-bold text-cyan-300 text-sm">{detailsRecord.fastMove || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-sm">Charged Attack</span>
                <span className="font-bold text-cyan-300 text-sm">{detailsRecord.chargedMove || '—'}</span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  deleteRecord(detailsRecord.id);
                  setDetailsRecord(null);
                }}
                className="flex-1 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300 font-bold py-3 rounded-xl text-sm transition"
              >
                Delete
              </button>
              <button
                onClick={() => setDetailsRecord(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl text-sm transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Preview Modal */}
      {inspectedImage && (
        <div
          className="fixed inset-0 bg-slate-950/95 z-50 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setInspectedImage(null)}
        >
          <img src={inspectedImage} alt="Fullscreen View" className="max-w-full max-h-full object-contain rounded-xl" />
        </div>
      )}
    </div>
  );
}
