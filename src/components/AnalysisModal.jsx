import React from 'react';
import { 
  X, ExternalLink, Zap, Shield, Swords, 
  ShieldCheck, AlertCircle, CheckCircle2 
} from 'lucide-react';
import { TYPE_STYLES, analyzePokemonStrategy } from '../utils/pokemonStrategy';

export default function AnalysisModal({ pokemon, onClose }) {
  if (!pokemon) return null;

  const strat = analyzePokemonStrategy(pokemon);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-800 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black tracking-wide text-slate-100">
                {pokemon.name}
              </h2>
              <span className="text-sm font-bold text-slate-400">
                CP {pokemon.cp}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-1.5">
              {pokemon.types && pokemon.types.map(t => (
                <span
                  key={t}
                  className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border ${
                    TYPE_STYLES[t] || "bg-slate-800 text-slate-300 border-slate-700"
                  }`}
                >
                  {t}
                </span>
              ))}
              <span className="text-xs px-2 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {pokemon.ivPercentage}% IV ({pokemon.atk}/{pokemon.def}/{pokemon.hp})
              </span>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Catch Appraisal Verdict */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 mb-5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Catch Appraisal Verdict
          </span>
          <p className={`text-base font-extrabold ${strat.verdictColor}`}>
            {strat.verdict}
          </p>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            {strat.notes}
          </p>
        </div>

        {/* Role Badges */}
        <div className="mb-5">
          <span className="text-xs font-bold text-slate-400 block mb-2">
            Best Suited Roles:
          </span>
          <div className="flex flex-wrap gap-2">
            {strat.roles.map(role => {
              const isRaid = role.includes('Raid');
              const isGymAtk = role.includes('Gym Attacker');
              const isGymDef = role.includes('Gym Defender');
              const isPvp = role.includes('PvP');
              return (
                <div 
                  key={role}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${
                    isRaid ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' :
                    isGymAtk ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' :
                    isGymDef ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' :
                    isPvp ? 'bg-purple-500/10 border-purple-500/30 text-purple-300' :
                    'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  {isRaid && <Swords className="w-3.5 h-3.5 text-rose-400" />}
                  {isGymAtk && <Zap className="w-3.5 h-3.5 text-amber-400" />}
                  {isGymDef && <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />}
                  {isPvp && <Shield className="w-3.5 h-3.5 text-purple-400" />}
                  <span>{role}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Moveset TM Advice */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4 mb-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">
              Moveset Audit & TM Advice
            </span>
            {strat.shouldTM ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> TM Suggested
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Optimal Set
              </span>
            )}
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-bold text-slate-300">Fast Attack:</span>
                <span className="text-slate-100 font-semibold">{pokemon.fastMove || 'None'}</span>
              </div>
              <p className="text-slate-400 leading-normal">{strat.fastAdvice}</p>
            </div>

            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-3.5 h-3.5 text-rose-400" />
                <span className="font-bold text-slate-300">Charged Attack:</span>
                <span className="text-slate-100 font-semibold">{pokemon.chargedMove || 'None'}</span>
              </div>
              <p className="text-slate-400 leading-normal">{strat.chargedAdvice}</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-2">
          <a
            href={`https://pokemon.gameinfo.io/en/pokemon/${pokemon.name.toLowerCase()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open GameInfo Guide</span>
          </a>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200"
          >
            Close Analysis
          </button>
        </div>
      </div>
    </div>
  );
}
