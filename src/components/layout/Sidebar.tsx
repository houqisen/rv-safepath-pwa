import React from 'react';
import { RvProfile } from '../../types/rv';

interface SidebarProps {
  activeTab: 'intime' | 'router' | 'planner' | 'checklist';
  setActiveTab: (tab: 'intime' | 'router' | 'planner' | 'checklist') => void;
  profile: RvProfile;
  onTabChange?: (tab: 'intime' | 'router' | 'planner' | 'checklist') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, profile, onTabChange }) => {
  const combinedLen = profile.combinedLengthFeet || profile.lengthFeet;
  const formattedHeight = `${profile.heightFeet}' ${profile.heightInches}"`;
  const safeMpgDisplay = Number(profile.towingMpg) || 10;
  const safeFuelRange = safeMpgDisplay * 25;

  const handleSelectTab = (tab: 'intime' | 'router' | 'planner' | 'checklist') => {
    setActiveTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  return (
    <nav className="md:w-64 bg-slate-800/90 border-r border-slate-700 flex md:flex-col justify-around md:justify-start p-2 md:p-3 gap-1 z-20 shrink-0 order-last md:order-first">
      <button 
        onClick={() => handleSelectTab('intime')} 
        className={`flex-1 md:flex-none flex flex-col md:flex-row items-center gap-2 p-2.5 rounded-xl text-xs md:text-sm font-medium transition ${
          activeTab === 'intime' 
            ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' 
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
        }`}
      >
        <i className="fa-solid fa-compass text-lg md:text-base"></i>
        <span>In-Time Finder</span>
      </button>

      <button 
        onClick={() => handleSelectTab('router')} 
        className={`flex-1 md:flex-none flex flex-col md:flex-row items-center gap-2 p-2.5 rounded-xl text-xs md:text-sm font-medium transition ${
          activeTab === 'router' 
            ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' 
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
        }`}
      >
        <i className="fa-solid fa-route text-lg md:text-base"></i>
        <span>Safe Router</span>
      </button>

      <button 
        onClick={() => handleSelectTab('planner')} 
        className={`flex-1 md:flex-none flex flex-col md:flex-row items-center gap-2 p-2.5 rounded-xl text-xs md:text-sm font-medium transition ${
          activeTab === 'planner' 
            ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' 
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
        }`}
      >
        <i className="fa-solid fa-calendar-days text-lg md:text-base"></i>
        <span>Trip Planner</span>
      </button>

      <button 
        onClick={() => handleSelectTab('checklist')} 
        className={`flex-1 md:flex-none flex flex-col md:flex-row items-center gap-2 p-2.5 rounded-xl text-xs md:text-sm font-medium transition ${
          activeTab === 'checklist' 
            ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' 
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
        }`}
      >
        <i className="fa-solid fa-list-check text-lg md:text-base"></i>
        <span>RV Checklists</span>
      </button>

      {/* Active RV Specs Footer Card */}
      <div className="hidden md:block bg-slate-900/80 border border-slate-700/80 rounded-xl p-3 text-xs space-y-2 mt-auto">
        <div className="flex items-center justify-between text-slate-400 font-semibold border-b border-slate-700/60 pb-1.5">
          <span className="uppercase text-[10px] tracking-wider">ACTIVE RV SPECS</span>
          <i className="fa-solid fa-shield-halved text-emerald-400 text-xs"></i>
        </div>
        <div className="space-y-1 text-[11px] text-slate-300">
          <div className="flex justify-between">
            <span className="text-slate-400">Class/Type:</span>
            <span className="font-semibold text-emerald-300 truncate max-w-[110px]">{profile.rvType} ({profile.ampRating})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Height:</span>
            <span className="font-bold text-amber-400">{formattedHeight}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Length/Weight:</span>
            <span className="truncate max-w-[130px]">{profile.lengthFeet}ft ({combinedLen}ft combined) / {profile.weightLbs.toLocaleString()} lbs</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Towing MPG:</span>
            <span className="font-bold text-amber-300">{safeMpgDisplay} MPG (~{safeFuelRange} mi range)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Tow Vehicle:</span>
            {profile.isEvTowVehicle ? (
              <span className="text-cyan-300 font-semibold truncate max-w-[120px] flex items-center gap-1">
                <i className="fa-solid fa-bolt text-[10px] text-cyan-400"></i> EV ({profile.evTowingRangeMiles || 140} mi)
              </span>
            ) : (
              <span className="text-slate-300 truncate max-w-[120px]">{profile.towSetup}</span>
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Off-Grid Power:</span>
            <span className="text-amber-400 flex items-center gap-1">
              <i className="fa-solid fa-solar-panel text-[10px]"></i> {profile.solarWatts ? profile.solarWatts.split(' ')[0] : '200W'}
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
};
