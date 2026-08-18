import React from 'react';
import { RvProfile } from '../../types/rv';

interface SidebarProps {
  activeTab: 'finder' | 'router' | 'planner' | 'checklists';
  setActiveTab: (tab: 'finder' | 'router' | 'planner' | 'checklists') => void;
  profile: RvProfile;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, profile }) => {
  const combinedLen = profile.combinedLengthFeet || profile.lengthFeet;
  const safeMpgDisplay = Number(profile.towingMpg) || 10;
  const safeFuelRange = safeMpgDisplay * 25;

  const tabs: { id: 'finder' | 'router' | 'planner' | 'checklists'; label: string; icon: string }[] = [
    { id: 'finder', label: 'In-Time Finder', icon: 'fa-solid fa-map-location-dot' },
    { id: 'router', label: 'Safe Router', icon: 'fa-solid fa-route' },
    { id: 'planner', label: 'Trip Planner', icon: 'fa-solid fa-calendar-days' },
    { id: 'checklists', label: 'Checklists', icon: 'fa-solid fa-list-check' }
  ];

  return (
    <div className="w-full md:w-64 bg-slate-900 border-r border-slate-800 p-3 md:p-4 flex flex-row md:flex-col justify-between shrink-0 shadow-lg md:min-h-[calc(100vh-61px)]">
      <div className="space-y-1 w-full flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl font-medium text-xs transition shrink-0 md:w-full ${
              activeTab === tab.id
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <i className={`${tab.icon} text-sm w-4 text-center`}></i>
            <span className="whitespace-nowrap">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="hidden md:block bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 text-[11px] text-slate-400 space-y-1.5 mt-4">
        <div className="text-slate-300 font-semibold flex items-center justify-between">
          <span>Active Rig Specs</span>
          <span className="text-[10px] text-emerald-400 font-mono">ACTIVE</span>
        </div>
        <div className="flex justify-between">
          <span>Type:</span>
          <span className="text-slate-200 font-medium truncate max-w-[110px]">{profile.rvType}</span>
        </div>
        <div className="flex justify-between">
          <span>Combined:</span>
          <span className="text-slate-200 font-medium">{combinedLen} ft</span>
        </div>
        <div className="flex justify-between">
          <span>Weight:</span>
          <span className="text-slate-200 font-medium">{profile.weightLbs.toLocaleString()} lbs</span>
        </div>
        <div className="flex justify-between">
          <span>Towing MPG:</span>
          <span className="text-amber-400 font-medium">{safeMpgDisplay} MPG (~{safeFuelRange} mi)</span>
        </div>
        <div className="flex justify-between">
          <span>Hookup:</span>
          <span className="text-sky-300 font-medium uppercase">{profile.minHookup}</span>
        </div>
      </div>
    </div>
  );
};
