import React, { useState, useEffect } from 'react';
import { 
  Upload, Search, Shield, Zap, Sparkles, Trash2, 
  RefreshCw, X, Layers, Image as ImageIcon, Download, UploadCloud, 
  Plus, Award, ChevronRight
} from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { supabase } from './supabase';
import { TYPE_STYLES } from './utils/pokemonStrategy';
import AnalysisModal from './components/AnalysisModal';

const typeCache = JSON.parse(localStorage.getItem('poke_type_cache') || '{}');

const fetchPokemonTypesOnline = async (speciesName) => {
  if (!speciesName) return [];
  const cleanName = speciesName.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  if (typeCache[cleanName]) return typeCache[cleanName];

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${cleanName}`);
    if (!res.ok) throw new Error('Not found');
    const data = await res.json();
    const types = data.types.map(
      (t) => t.type.name.charAt(0).toUpperCase() + t.type.name.slice(1)
    );
    typeCache[cleanName] = types;
    localStorage.setItem('poke_type_cache', JSON.stringify(typeCache));
    return types;
  } catch {
    return [];
  }
};
// Base offline fallback
const FALLBACK_MOVES = [
  "Mud Shot", "Metal Claw", "Dragon Tail", "Dragon Breath", "Counter", 
  "Shadow Claw", "Vine Whip", "Razor Leaf", "Water Gun", "Waterfall",
  "Fire Fang", "Fire Spin", "Incinerate", "Bullet Punch", "Snarl",
  "Bite", "Lick", "Psycho Cut", "Confusion", "Lock-On", "Thunder Shock",
  "Volt Switch", "Spark", "Poison Jab", "Hex", "Air Slash", "Wing Attack",
  "Gust", "Ice Shard", "Powder Snow", "Smack Down", "Rock Throw", "Mud-Slap",
  "Dragon Claw", "Earth Power", "Earthquake", "Draco Meteor", "Precipice Blades", 
  "Roar of Time", "Iron Head", "Outrage", "Sand Tomb", "Hydro Cannon", "Surf", 
  "Origin Pulse", "Blast Burn", "Overheat", "Fire Blast", "Frenzy Plant", 
  "Solar Beam", "Energy Ball", "Grass Knot", "Wild Charge", "Thunderbolt", 
  "Thunder", "Zap Cannon", "Close Combat", "Dynamic Punch", "Aura Sphere", 
  "Superpower", "Cross Chop", "Shadow Ball", "Dark Pulse", "Foul Play", 
  "Crunch", "Psychic", "Psyshock", "Moonblast", "Play Rough", "Dazzling Gleam", 
  "Ice Beam", "Blizzard", "Avalanche", "Stone Edge", "Rock Slide", 
  "Sludge Bomb", "Sludge Wave", "Gunk Shot", "Brave Bird", "Sky Attack", 
  "Hurricane", "Fly", "Aeroblast", "Sacred Fire",
"Body Slam", "Zen Headbutt", "Lick", "Heavy Slam", "Superpower", "Hyper Beam"
];

// In-memory master list (starts with cached or fallback, updates live)
let liveMovesList = JSON.parse(localStorage.getItem('poke_all_moves') || '[]');
if (liveMovesList.length === 0) {
  liveMovesList = FALLBACK_MOVES;
}

// Automatically pulls ALL 900+ official moves from PokéAPI and caches them
export const syncLiveMovesFromApi = async () => {
  try {
    const cached = localStorage.getItem('poke_all_moves');
    if (cached) {
      liveMovesList = JSON.parse(cached);
      return;
    }

    const res = await fetch('https://pokeapi.co/api/v2/move?limit=1000');
    if (!res.ok) return;

    const data = await res.json();
    // Convert 'earth-power' -> 'Earth Power', 'dragon-claw' -> 'Dragon Claw'
    const formattedMoves = data.results.map((m) =>
      m.name
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    );

    liveMovesList = Array.from(new Set([...FALLBACK_MOVES, ...formattedMoves]));
    localStorage.setItem('poke_all_moves', JSON.stringify(liveMovesList));
  } catch (err) {
    console.warn('Could not fetch live moves from PokéAPI, using fallback list.', err);
  }
};
const getSimilarity = (s1, s2) => {
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();
  if (str1.includes(str2) || str2.includes(str1)) return 0.85;

  const track = Array(str2.length + 1).fill(null).map(() =>
    Array(str1.length + 1).fill(null)
  );
  for (let i = 0; i <= str1.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= str2.length; j += 1) track[j][0] = j;

  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }
  const distance = track[str2.length][str1.length];
  return 1 - distance / Math.max(str1.length, str2.length);
};

const matchNearestMove = (rawOcrText) => {
  if (!rawOcrText || rawOcrText.length < 3) return "";

  // Strip numbers and non-letter symbols
  const cleaned = rawOcrText.replace(/\d+/g, '').replace(/[^a-zA-Z\s]/g, '').trim();
  const lowerCleaned = cleaned.toLowerCase();

  const movesToSearch = (liveMovesList && liveMovesList.length > 0) ? liveMovesList : FALLBACK_MOVES;

  // 1. Sort candidate moves by length descending so "Discharge" matches before "Charge"
  const sortedMoves = [...movesToSearch].sort((a, b) => b.length - a.length);

  for (const move of sortedMoves) {
    const lowerMove = move.toLowerCase();
    // Match exact word boundary or full prefix/contains
    const regex = new RegExp(`\\b${lowerMove}\\b`, 'i');
    if (regex.test(lowerCleaned) || lowerCleaned.startsWith(lowerMove)) {
      return move;
    }
  }

  // 2. Fuzzy match fallback
  let bestMatch = "";
  let highestScore = 0;

  for (const move of sortedMoves) {
    const score = getSimilarity(cleaned, move);
    if (score > highestScore) {
      highestScore = score;
      bestMatch = move;
    }
  }

  return highestScore >= 0.60 ? bestMatch : "";
};

const getAllRecords = async () => {
  const { data, error } = await supabase
    .from('pokemon_records')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching records:', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    cp: row.cp,
    atk: row.atk,
    def: row.def,
    hp: row.hp,
    ivPercentage: Number(row.iv_percentage),
    fastMove: row.fast_move || '',
    chargedMove: row.charged_move || '',
    tags: row.tags || [],
    types: row.types || [],
    screenshot: row.screenshot_url || '',
    createdAt: Number(row.created_at)
  }));
};

const saveRecord = async (record) => {
  const payload = {
    id: record.id,
    name: record.name,
    cp: record.cp,
    atk: record.atk,
    def: record.def,
    hp: record.hp,
    iv_percentage: record.ivPercentage,
    fast_move: record.fastMove,
    charged_move: record.chargedMove,
    tags: record.tags || [],
    types: record.types || [],
    created_at: record.createdAt || Date.now()
  };

  const { error } = await supabase.from('pokemon_records').upsert(payload);
  if (error) console.error('Error saving record to Supabase:', error);
};

const deleteRecord = async (id) => {
  const { error } = await supabase.from('pokemon_records').delete().eq('id', id);
  if (error) console.error('Error deleting record from Supabase:', error);
};

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

  useEffect(() => {
    loadAll();
    syncLiveMovesFromApi(); // Runs in the background once on startup
  }, []);
  // Listen for incoming 1-click import links from Gemini
  useEffect(() => {
    const handleUrlImport = async () => {
      const params = new URLSearchParams(window.location.search);
      const name = params.get('name');
      const cp = params.get('cp');

      // Only run if the link contains Pokémon data
      if (name && cp) {
        setStatusMsg(`Importing ${name} from Gemini link...`);
        setIsProcessing(true);

        const atk = parseInt(params.get('atk') || '0', 10);
        const def = parseInt(params.get('def') || '0', 10);
        const hp = parseInt(params.get('hp') || '0', 10);
        const totalIv = atk + def + hp;
        const ivPercentage = parseFloat(((totalIv / 45) * 100).toFixed(1));

        // Fetch official types automatically
        const types = await fetchPokemonTypesOnline(name);

        const tags = [];
        if (totalIv === 45) tags.push('Hundo (100%)');
        const numCp = parseInt(cp, 10);
        if (numCp <= 1500) tags.push('Great League');
        else if (numCp <= 2500) tags.push('Ultra League');
        else tags.push('Master League');

        const newRecord = {
          id: 'poke_' + Date.now(),
          name,
          cp: numCp,
          atk,
          def,
          hp,
          ivPercentage,
          fastMove: params.get('fast') || '',
          chargedMove: params.get('charged') || '',
          tags,
          types,
          screenshot: '',
          createdAt: Date.now()
        };

        await saveRecord(newRecord);
        await loadAll();

        setIsProcessing(false);
        setStatusMsg('');

        // Clean query params from the browser address bar without reloading
        window.history.replaceState({}, document.title, window.location.pathname);
        alert(`Successfully saved ${name} (${ivPercentage}% IV) to PokéVault!`);
      }
    };

    handleUrlImport();
  }, []);
  
  const loadAll = async () => {
    const data = await getAllRecords();
    setRecords(data);
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

  const checkIfAppraisal = (canvas) => {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    let badgeGoldPixels = 0;

    for (let y = Math.round(H * 0.62); y <= Math.round(H * 0.74); y += 3) {
      for (let x = Math.round(W * 0.05); x <= Math.round(W * 0.25); x += 3) {
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const [h, s, l] = rgbToHsl(pixel[0], pixel[1], pixel[2]);
        if (h >= 24 && h <= 50 && s >= 45 && l >= 35 && l <= 85) {
          badgeGoldPixels++;
        }
      }
    }
    return badgeGoldPixels > 35;
  };

  // 1. In analyzeIVBars: shifted slightly upward to center Attack, Defense, and HP
 const analyzeIVBars = (canvas) => {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    const startX = Math.round(W * 0.118);
    const endX = Math.round(W * 0.456);
    const totalBarWidth = endX - startX;

    const yStart = Math.round(H * 0.72);
    const yEnd = Math.round(H * 0.88);

    // Multi-column sampling to avoid hitting white segment dividers
    const probeXs = [Math.round(W * 0.20), Math.round(W * 0.28), Math.round(W * 0.36)];
    
    let barRowCandidates = [];
    for (const px of probeXs) {
      const candidates = [];
      let inBar = false;
      let barStartY = 0;

      for (let y = yStart; y <= yEnd; y++) {
        const p = ctx.getImageData(px, y, 1, 1).data;
        const isCardWhite = (p[0] > 230 && p[1] > 230 && p[2] > 230);

        if (!isCardWhite && !inBar) {
          inBar = true;
          barStartY = y;
        } else if (isCardWhite && inBar) {
          inBar = false;
          const barHeight = y - barStartY;
          if (barHeight >= 4 && barHeight <= 26) {
            candidates.push(Math.round((barStartY + y) / 2));
          }
        }
      }
      if (candidates.length === 3) {
        barRowCandidates = candidates;
        break;
      } else if (candidates.length > barRowCandidates.length) {
        barRowCandidates = candidates;
      }
    }

    let barCenters = [];
    if (barRowCandidates.length === 3) {
      barCenters = barRowCandidates;
    } else if (barRowCandidates.length > 3) {
      barCenters = barRowCandidates.slice(-3);
    } else {
      // Calibrated baseline fallback
      barCenters = [
        Math.round(H * 0.755),
        Math.round(H * 0.798),
        Math.round(H * 0.840)
      ];
    }

    const ivs = barCenters.map((yCenter) => {
      let filledPixels = 0;
      let coralRedPixels = 0;
      const offsets = [-3, -1, 0, 1, 3];

      for (let x = startX; x <= endX; x++) {
        let isFilled = false;
        let isRed = false;

        for (let dy of offsets) {
          const pixel = ctx.getImageData(x, yCenter + dy, 1, 1).data;
          const [r, g, b] = [pixel[0], pixel[1], pixel[2]];
          const [h, s, l] = rgbToHsl(r, g, b);

          const isOrange = (h >= 14 && h <= 55 && s >= 28 && l >= 25 && l <= 85);
          const isCoralRed = ((h >= 335 || h <= 18) && s >= 20 && l >= 28 && l <= 85 && r > g + 18);

          if (isCoralRed) {
            isRed = true;
            isFilled = true;
            break;
          } else if (isOrange) {
            isFilled = true;
            break;
          }
        }
        if (isFilled) filledPixels++;
        if (isRed) coralRedPixels++;
      }

      if (coralRedPixels > totalBarWidth * 0.38) {
        return 15;
      }

      const ratio = Math.min(1, Math.max(0, filledPixels / totalBarWidth));
      return Math.min(15, Math.max(0, Math.round(ratio * 15)));
    });

    const cropTop = barCenters[0] - Math.round(H * 0.030);

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
const extractMovesFromCanvas = async (worker, canvas) => {
    const mY = Math.round(canvas.height * 0.50);
    const mW = Math.round(canvas.width * 0.90);
    const mH = Math.round(canvas.height * 0.42);

    const moveCanvas = document.createElement('canvas');
    moveCanvas.width = mW;
    moveCanvas.height = mH;
    moveCanvas.getContext('2d').drawImage(
      canvas,
      Math.round(canvas.width * 0.05),
      mY,
      mW, mH, 0, 0, mW, mH
    );

    const moveRes = await worker.recognize(moveCanvas);
    const rawLines = moveRes.data.lines.map(l => l.text.trim());

    let startIdx = rawLines.findIndex(t => {
      const up = t.toUpperCase();
      return up.includes('GYM') || up.includes('RAID') || up.includes('TRAINER');
    });

    const linesAfterTab = startIdx !== -1 ? rawLines.slice(startIdx + 1) : rawLines;

    const moveAreaLines = [];
    for (let line of linesAfterTab) {
      const up = line.toUpperCase();
       if (
        up.includes('NEW ATTACK') || 
        up.includes('MAX MOVE') || 
        up.includes('OBTAINED') || 
        up.includes('CAUGHT') ||
        up.includes('WALKED') ||
        up.includes('WEIGHT') ||
        up.includes('HEIGHT')
      ) {
        break;
      }

      if (
        line.length < 3 ||
        up.includes('GYM') ||
        up.includes('RAID') ||
        up.includes('TRAINER') ||
        up.includes('MEGA') ||
        up.includes('EVOLVE') ||
        up.includes('POWER UP') ||
        up.includes('STARDUST') ||
        up.includes('CANDY') ||
        up.includes('WEATHER') ||
        up.includes('BONUS')
      ) {
        continue;
      }

      moveAreaLines.push(line);
    }

    const recognizedMoves = [];
    for (let raw of moveAreaLines) {
      const matched = matchNearestMove(raw);
      if (matched && !recognizedMoves.includes(matched)) {
        recognizedMoves.push(matched);
      }
    }

    return {
      fast: recognizedMoves[0] || '',
      charged: recognizedMoves.slice(1).join(' / ')
    };
  };

  const handleFilesSelected = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setIsProcessing(true);

    const rawFiles = Array.from(fileList);
    setStatusMsg(`Loading ${rawFiles.length} screenshot(s)...`);

    try {
      const loadedScreens = [];
      for (let file of rawFiles) {
        const dataUrl = await new Promise((res) => {
          const reader = new FileReader();
          reader.onload = (e) => res(e.target.result);
          reader.readAsDataURL(file);
        });
        const img = new Image();
        img.src = dataUrl;
        await new Promise((res) => (img.onload = res));

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);

        const isAppraisal = checkIfAppraisal(canvas);
        loadedScreens.push({ canvas, dataUrl, isAppraisal });
      }

      loadedScreens.sort((a, b) => (b.isAppraisal ? 1 : 0) - (a.isAppraisal ? 1 : 0));

      const worker = await createWorker('eng');
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
        types: [],
        screenshot: '',
        createdAt: Date.now()
      };

      // Reset moves before parsing a moveset screen so prior scans never linger
      if (!isAppraisal) {
        current.fastMove = '';
        current.chargedMove = '';
      }
      for (let i = 0; i < loadedScreens.length; i++) {
        const { canvas, dataUrl, isAppraisal } = loadedScreens[i];

        if (isAppraisal) {
          setStatusMsg(`Analyzing Appraisal Screen (${i + 1}/${loadedScreens.length})...`);
          const ivs = analyzeIVBars(canvas);

          // CP Crop
          const cpW = Math.round(canvas.width * 0.45);
          const cpH = Math.round(canvas.height * 0.08);
          const cpCanvas = document.createElement('canvas');
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

          // Species Name Crop
          const nW = Math.round(canvas.width * 0.6);
          const nH = Math.round(canvas.height * 0.06);
          const nameCanvas = document.createElement('canvas');
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

          // Adjusted Debug Visual Crop:
          // Shifted Y from 0.75 down to 0.725 and widened slightly to center Attack, Defense, and HP
          const dW = Math.round(canvas.width * 0.44);
          const dH = Math.round(canvas.height * 0.16);
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

          const totalIv = ivs.atk + ivs.def + ivs.hp;
          current.atk = ivs.atk;
          current.def = ivs.def;
          current.hp = ivs.hp;
          current.ivPercentage = parseFloat(((totalIv / 45) * 100).toFixed(1));
          
          if (cleanName.length >= 3) {
            current.name = cleanName;
            setStatusMsg(`Fetching types for ${cleanName}...`);
            current.types = await fetchPokemonTypesOnline(cleanName);
          }
          if (cpMatch) current.cp = parseInt(cpMatch[0], 10);
          current.screenshot = dataUrl;
        }else {
          setStatusMsg(`Analyzing Moveset Screen (${i + 1}/${loadedScreens.length})...`);
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
      console.error('Scan error:', err);
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

  const importJSON = async (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const list = JSON.parse(e.target.result);
        if (Array.isArray(list)) {
          for (let item of list) {
            const types = (item.types && item.types.length > 0)
              ? item.types
              : await fetchPokemonTypesOnline(item.name);
            await saveRecord({ ...item, types });
          }
          await loadAll();
          alert('Import completed successfully!');
        }
      } catch {
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
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 shadow-sm transition-all active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <label 
              title="Import JSON Backup"
              className="cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 shadow-sm transition-all active:scale-95"
            >
              <UploadCloud className="w-3.5 h-3.5 text-amber-400" />
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
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFilesSelected(e.target.files);
                    e.target.value = '';
                  }
                }}
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

                    {item.types && item.types.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1">
                        {item.types.map((t) => (
                          <span
                            key={t}
                            className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border ${
                              TYPE_STYLES[t] || "bg-slate-800 text-slate-300 border-slate-700"
                            }`}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-1.5">
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
                    className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
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

              <div className="mt-4 pt-3 border-t border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {item.tags && item.tags.map(t => (
                      <span key={t} className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                        {t}
                      </span>
                    ))}
                  </div>
                  {item.screenshot && (
                    <button
                      onClick={() => setInspectedImage(item.screenshot)}
                      className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 font-medium"
                    >
                      <ImageIcon className="w-3 h-3" /> Pic
                    </button>
                  )}
                </div>

                {/* Open Analysis Modal */}
                <button
                  onClick={() => setDetailsRecord(item)}
                  className="w-full mt-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-xs font-semibold text-cyan-400 border border-slate-700 transition-all active:scale-[0.98]"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>View Analysis & Strategy</span>
                  <ChevronRight className="w-3 h-3 ml-auto text-slate-500" />
                </button>
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

      {/* SEPARATE MODAL COMPONENT */}
      <AnalysisModal 
        pokemon={detailsRecord} 
        onClose={() => setDetailsRecord(null)} 
      />

      {/* VERIFY / EDIT MODAL */}
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
                    onChange={async (e) => {
                      const newName = e.target.value;
                      const types = await fetchPokemonTypesOnline(newName);
                      setActiveRecord({ ...activeRecord, name: newName, types });
                    }}
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
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleFilesSelected([e.target.files[0]]);
                          e.target.value = '';
                        }
                      }}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Fast Attack</label>
                    <input
                      type="text"
                      value={activeRecord.fastMove}
                      placeholder="e.g. Mud Shot"
                      onChange={(e) => setActiveRecord({ ...activeRecord, fastMove: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Charged Attack</label>
                    <input
                      type="text"
                      value={activeRecord.chargedMove}
                      placeholder="e.g. Earthquake"
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
