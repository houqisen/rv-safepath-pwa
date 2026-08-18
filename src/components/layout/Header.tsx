import React from 'react';
import { RvProfile } from '../../types/rv';

interface HeaderProps {
  profile: RvProfile;
  onOpenProfile: () => void;
}

export const Header: React.FC<HeaderProps> = ({ profile, onOpenProfile }) => {
  const formattedHeight = `${profile.heightFeet}' ${profile.heightInches}"`;

  return (
    <header className="bg-slate-800/90 backdrop-blur border-b border-slate-700/80 px-4 py-3 flex items-center justify-between z-30 shrink-0">
      <div className="flex items-center space-x-3">
        <div className="bg-emerald-500/20 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/30">
          <i className="fa-solid fa-caravan text-xl"></i>
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight tracking-wide flex items-center gap-2 text-slate-100">
            RV SafePath
          </h1>
          <p className="text-xs text-slate-400 hidden sm:block">Smart RV Routing, Low Clearance Guard &amp; Real-Time Google Places Finder</p>
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-3">
        <div 
          onClick={onOpenProfile} 
          className="flex items-center gap-1.5 bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs px-2.5 py-1.5 rounded-lg font-medium cursor-pointer"
        >
          <i className="fa-solid fa-satellite-dish text-sky-400 animate-pulse"></i>
          <span className="hidden lg:inline">{profile.hasStarlink ? "Starlink Online" : "Cellular Only"}</span>
        </div>

        <div 
          onClick={onOpenProfile} 
          className="hidden sm:flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs px-3 py-1.5 rounded-lg font-medium cursor-pointer"
        >
          <i className="fa-solid fa-ruler-vertical text-amber-400"></i>
          <span>Max Height: <strong>{formattedHeight}</strong></span>
        </div>

        <button 
          onClick={onOpenProfile} 
          className="bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm px-3 py-2 rounded-xl flex items-center gap-2 border border-slate-600 transition"
        >
          <i className="fa-solid fa-sliders text-emerald-400"></i>
          <span className="hidden md:inline">RV Profile</span>
        </button>
      </div>
    </header>
  );
};
