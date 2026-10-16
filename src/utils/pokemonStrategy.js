// Official Pokémon type pill colors in Tailwind
export const TYPE_STYLES = {
  Normal: "bg-stone-500/20 text-stone-300 border-stone-500/40",
  Fire: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  Water: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  Grass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
  Electric: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  Ice: "bg-cyan-400/20 text-cyan-300 border-cyan-400/40",
  Fighting: "bg-red-700/20 text-red-400 border-red-700/40",
  Poison: "bg-purple-600/20 text-purple-300 border-purple-600/40",
  Ground: "bg-amber-700/20 text-amber-300 border-amber-700/40",
  Flying: "bg-indigo-400/20 text-indigo-300 border-indigo-400/40",
  Psychic: "bg-pink-500/20 text-pink-300 border-pink-500/40",
  Bug: "bg-lime-600/20 text-lime-400 border-lime-600/40",
  Rock: "bg-stone-600/20 text-stone-300 border-stone-600/40",
  Ghost: "bg-violet-800/20 text-violet-300 border-violet-800/40",
  Dragon: "bg-indigo-700/20 text-indigo-300 border-indigo-700/40",
  Steel: "bg-slate-400/20 text-slate-300 border-slate-400/40",
  Fairy: "bg-rose-400/20 text-rose-300 border-rose-400/40",
  Dark: "bg-neutral-800 text-neutral-300 border-neutral-700"
};

// Curated meta move profiles and strategic roles
export const META_KNOWLEDGE_BASE = {
  dialga: {
    idealFast: "Dragon Breath",
    idealCharged: ["Roar of Time", "Iron Head", "Draco Meteor"],
    isRaidAttacker: true,
    isGymAttacker: true,
    isGymDefender: false,
    isPvp: true,
    pvpLeague: "Master League",
    notes: "Requires 15 Attack for key breakpoints in Master League. Dragon Breath + Iron Head / Roar of Time is the premier competitive set."
  },
  groudon: {
    idealFast: "Mud Shot",
    idealCharged: ["Precipice Blades", "Fire Punch", "Earthquake"],
    isRaidAttacker: true,
    isGymAttacker: true,
    isGymDefender: false,
    isPvp: true,
    pvpLeague: "Master League",
    notes: "Top-tier Ground raid attacker with Primal Reversion. Precipice Blades is a strict upgrade over Earthquake."
  },
  kyogre: {
    idealFast: "Waterfall",
    idealCharged: ["Origin Pulse", "Surf"],
    isRaidAttacker: true,
    isGymAttacker: true,
    isGymDefender: false,
    isPvp: true,
    pvpLeague: "Master League",
    notes: "The apex Water raid attacker with Primal Reversion. Origin Pulse or Surf are mandatory."
  },
  blissey: {
    idealFast: "Zen Headbutt",
    idealCharged: ["Dazzling Gleam"],
    isRaidAttacker: false,
    isGymAttacker: false,
    isGymDefender: true,
    isPvp: false,
    pvpLeague: "N/A",
    notes: "The ultimate Gym Defender sponge. High stamina pool drains the opponent's timer."
  },
  chansey: {
    idealFast: "Zen Headbutt",
    idealCharged: ["Dazzling Gleam"],
    isRaidAttacker: false,
    isGymAttacker: false,
    isGymDefender: true,
    isPvp: false,
    pvpLeague: "N/A",
    notes: "Top-tier Gym defender alongside Blissey due to massive HP pool."
  },
  machamp: {
    idealFast: "Counter",
    idealCharged: ["Dynamic Punch", "Cross Chop"],
    isRaidAttacker: true,
    isGymAttacker: true,
    isGymDefender: false,
    isPvp: true,
    pvpLeague: "Great & Ultra League",
    notes: "Exceptional Gym clearer against normal-type defenders. High value in PvP and Fighting raid teams."
  }
};

// Analysis engine: evaluates appraisal, roles, and movesets
export const analyzePokemonStrategy = (pokemon) => {
  if (!pokemon) return null;

  const nameKey = (pokemon.name || '').toLowerCase().trim();
  const meta = META_KNOWLEDGE_BASE[nameKey];
  const ivTotal = (pokemon.atk || 0) + (pokemon.def || 0) + (pokemon.hp || 0);
  const ivPct = pokemon.ivPercentage || ((ivTotal / 45) * 100);

  let verdict = "Dex Entry Only";
  let verdictColor = "text-slate-400";
  let roles = [];

  const isHighIv = ivPct >= 82.2;
  const isHundo = ivTotal === 45;

  if (meta) {
    if (meta.isRaidAttacker && isHighIv) roles.push("Raid Attacker");
    if (meta.isGymAttacker) roles.push("Gym Attacker");
    if (meta.isGymDefender) roles.push("Gym Defender");
    if (meta.isPvp) roles.push(`PvP (${meta.pvpLeague})`);

    if (isHundo) {
      verdict = "Perfect Hundo • Top Priority Investment";
      verdictColor = "text-rose-400";
    } else if (isHighIv && (meta.isRaidAttacker || meta.isPvp)) {
      verdict = "Elite Keeper • Safe to Power Up";
      verdictColor = "text-emerald-400";
    } else if (roles.length > 0) {
      verdict = "Usable Budget Attacker / Defender";
      verdictColor = "text-amber-400";
    }
  } else {
    // Dynamic rule heuristics for unlisted Pokémon
    if (isHundo) {
      verdict = "Perfect IV (100%) • Keeper";
      verdictColor = "text-rose-400";
      roles.push("Trophy / Raid Candidate");
    } else if (isHighIv && pokemon.atk >= 13) {
      verdict = "Solid Raid / Gym Contender";
      verdictColor = "text-emerald-400";
      roles.push("Raid Attacker", "Gym Attacker");
    } else if (pokemon.atk <= 3 && pokemon.def >= 12 && pokemon.hp >= 12) {
      verdict = "High Bulk PvP Stat Product Candidate";
      verdictColor = "text-cyan-400";
      roles.push("PvP Great/Ultra Candidate");
    } else if (pokemon.hp >= 13 && pokemon.def >= 13) {
      roles.push("Gym Defender");
      verdict = "Decent Gym Defender";
      verdictColor = "text-amber-400";
    } else {
      verdict = "Candy / Transfer / Dex Entry Only";
      verdictColor = "text-slate-400";
      roles.push("Pokedex Only");
    }
  }

  // TM move advice
  let fastAdvice = "Move looks good or standard.";
  let chargedAdvice = "Move looks good or standard.";
  let shouldTM = false;

  if (meta) {
    if (pokemon.fastMove && !pokemon.fastMove.toLowerCase().includes(meta.idealFast.toLowerCase())) {
      fastAdvice = `TM Fast Move: Change to "${meta.idealFast}" for maximum energy/damage.`;
      shouldTM = true;
    } else {
      fastAdvice = `Optimal Fast Move! "${pokemon.fastMove}" is best in slot.`;
    }

    const currentCharged = (pokemon.chargedMove || '').toLowerCase();
    const matchesIdealCharged = meta.idealCharged.some(m => currentCharged.includes(m.toLowerCase()));

    if (!matchesIdealCharged) {
      chargedAdvice = `TM Charged Move: Aim for ${meta.idealCharged.map(m => `"${m}"`).join(' or ')}.`;
      shouldTM = true;
    } else {
      chargedAdvice = `Optimal Charged Move! "${pokemon.chargedMove}" is verified top-tier.`;
    }
  }

  return {
    verdict,
    verdictColor,
    roles,
    shouldTM,
    fastAdvice,
    chargedAdvice,
    notes: meta?.notes || "Base evaluation calculated from IV distributions (Attack vs Bulk) and general raid/league viability."
  };
};
