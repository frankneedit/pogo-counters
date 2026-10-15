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
          if (m.status === "
