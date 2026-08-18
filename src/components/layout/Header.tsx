import React from 'react';
import { RvProfile } from '../../types/rv';

interface HeaderProps {
  profile: RvProfile;
  onOpenProfile: () => void;
}

export const Header: React.FC<HeaderProps> = ({ profile, onOpenProfile }) => {
  const formattedHeight = `${profile.heightFeet}' ${profile.heightInches}"`;

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-30 flex items-center justify-between shadow-md">
      <div className="flex items-center space-x-3">
        <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-xl border border-emerald-500/30">
          <i className="fa-solid fa-caravan text-xl"></i>
        </div>
        <div>
          <h1 className="font-bold text-lg text-slate-100 flex items-center gap-2">
            RV SafePath <span className="text-xs bg-emerald-500/20 text-emerald-400 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">PWA</span>
          </h1>
          <p className="text-xs text-slate-400">Intelligent RV Trip Planner &amp; Height Clearance Guard</p>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {profile.hasStarlink && (
          <div className="hidden sm:flex items-center space-x-1.5 bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs px-2.5 py-1 rounded-lg">
            <i className="fa-solid fa-satellite-dish text-xs animate-pulse"></i>
            <span className="font-medium">Starlink Ready</span>
          </div>
        )}

        <div 
          onClick={onOpenProfile}
          className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 px-3 py-1.5 rounded-xl cursor-pointer transition shadow-sm"
        >
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-slate-400 font-medium leading-none">Max Height</span>
            <span className="text-xs font-bold text-amber-400 leading-tight">{formattedHeight}</span>
          </div>
          <i className="fa-solid fa-shield-halved text-amber-400 text-sm"></i>
        </div>

        <button 
          onClick={onOpenProfile}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-3.5 py-2 rounded-xl transition shadow-md flex items-center space-x-1.5"
        >
          <i className="fa-solid fa-sliders"></i>
          <span className="hidden sm:inline">Rig Profile</span>
        </button>
      </div>
    </header>
  );
};
