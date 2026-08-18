import React, { useState } from 'react';
import { RvProfile } from '../../types/rv';
import { AuthUser } from '../../services/authService';

interface HeaderProps {
  profile: RvProfile;
  onOpenProfile: () => void;
  user?: AuthUser | null;
  onSignIn?: () => void;
  onSignOut?: () => void;
  isSyncing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  profile,
  onOpenProfile,
  user = null,
  onSignIn,
  onSignOut,
  isSyncing = false
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const formattedHeight = `${profile.heightFeet}' ${profile.heightInches}"`;

  return (
    <header className="bg-slate-900/90 border-b border-slate-800 px-3.5 sm:px-4 py-2.5 flex items-center justify-between z-30 shrink-0">
      {/* App Branding */}
      <div className="flex items-center gap-2.5">
        <div className="bg-emerald-600/20 text-emerald-400 p-2 rounded-xl border border-emerald-500/30 flex items-center justify-center">
          <i className="fa-solid fa-caravan text-base sm:text-lg"></i>
        </div>
        <div>
          <h1 className="font-black text-sm sm:text-base tracking-tight text-slate-100 flex items-center gap-1.5">
            RV SafePath
          </h1>
          <p className="hidden md:block text-[11px] text-slate-400">
            Smart RV Routing, Low Clearance Guard &amp; Real-Time Google Places Finder
          </p>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {/* Starlink / Online Status */}
        <div className="hidden lg:flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-full text-[11px] text-slate-400 border border-slate-700/80">
          <i className="fa-solid fa-satellite-dish text-sky-400 text-xs"></i>
          <span>Starlink Online</span>
        </div>

        {/* Max Height Pill */}
        <div className="flex items-center gap-1.5 bg-slate-800/90 border border-amber-500/30 px-2.5 py-1 rounded-lg text-xs">
          <i className="fa-solid fa-ruler-vertical text-amber-400"></i>
          <span className="text-slate-400 hidden sm:inline">Max Height:</span>
          <span className="font-bold text-amber-400">{formattedHeight}</span>
        </div>

        {/* RV Profile Modal Trigger Button */}
        <button 
          onClick={onOpenProfile} 
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
        >
          <i className="fa-solid fa-sliders text-emerald-400"></i>
          <span className="hidden sm:inline">RV Profile</span>
        </button>

        {/* User Authentication & Cloud Sync Section */}
        {user ? (
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(prev => !prev)}
              onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
              className="flex items-center gap-2 bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 px-2.5 py-1 rounded-xl text-xs text-slate-200 transition shadow-sm"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "User"}
                  className="w-5 h-5 rounded-full object-cover border border-emerald-500/40"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                  {(user.displayName || user.email || "U")[0]}
                </div>
              )}
              <span className="hidden md:inline font-medium max-w-[100px] truncate">
                {user.displayName || "RV Traveler"}
              </span>
              <i 
                className={`fa-solid fa-cloud text-xs ${isSyncing ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`} 
                title={isSyncing ? "Syncing with Cloud..." : "Cloud Sync Active"}
              ></i>
              <i className="fa-solid fa-chevron-down text-[9px] text-slate-400"></i>
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-3 py-2 border-b border-slate-800 text-[11px] text-slate-400">
                  Signed in as <br />
                  <strong className="text-slate-200 truncate block">{user.email || user.displayName}</strong>
                </div>
                <div className="px-3 py-1.5 text-[10px] text-emerald-400 flex items-center gap-1.5 border-b border-slate-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                  <span>Cloud Firestore Sync Active</span>
                </div>
                {onSignOut && (
                  <button
                    onClick={onSignOut}
                    className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-slate-800/80 flex items-center gap-2 transition"
                  >
                    <i className="fa-solid fa-right-from-bracket"></i> Sign Out
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          onSignIn && (
            <button
              onClick={onSignIn}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 hover:border-emerald-500/50 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
              title="Sign in with Google to sync across devices"
            >
              <i className="fa-brands fa-google text-emerald-400"></i>
              <span className="hidden sm:inline">Sign In</span>
            </button>
          )
        )}
      </div>
    </header>
  );
};
