import React from 'react';
import { RvProfile } from '../../types/rv';

interface RvProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: RvProfile;
  onSaveProfile: (updated: RvProfile) => void;
}

export const RvProfileModal: React.FC<RvProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaveProfile
}) => {
  const [localProfile, setLocalProfile] = React.useState<RvProfile>(profile);

  React.useEffect(() => {
    setLocalProfile(profile);
  }, [profile, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile(localProfile);
    onClose();
  };

  const safeMpgDisplay = Number(localProfile.towingMpg) || 10;
  const safeFuelRange = safeMpgDisplay * 25;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-lg">
              <i className="fa-solid fa-sliders text-lg"></i>
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">RV Vehicle Profile &amp; Towing Specs</h3>
              <p className="text-xs text-slate-400">Essential dimensions to prevent low-clearance accidents.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-lg p-1">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-200 flex-1">
            <div className="space-y-3">
              <h4 className="font-bold text-emerald-400 border-b border-slate-700/60 pb-1 uppercase tracking-wider text-[11px]">1. RV Type &amp; Dimensions</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Rig / Vehicle Type</label>
                  <select 
                    value={localProfile.rvType} 
                    onChange={(e) => setLocalProfile({ ...localProfile, rvType: e.target.value })} 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs focus:border-emerald-500"
                  >
                    <option value="Class A Motorhome">Class A Motorhome</option>
                    <option value="Class C Motorhome">Class C Motorhome</option>
                    <option value="Class B Camper Van">Class B Camper Van</option>
                    <option value="Fifth Wheel Trailer">Fifth Wheel Trailer</option>
                    <option value="Travel Trailer">Travel Trailer</option>
                    <option value="Truck Camper">Truck Camper</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Max Height Clearance (Ft &amp; In) <span className="text-amber-400 font-bold">*Critical</span></label>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      value={localProfile.heightFeet} 
                      onChange={(e) => setLocalProfile({ ...localProfile, heightFeet: parseInt(e.target.value) || 9 })} 
                      className="w-1/2 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-amber-400 font-bold" 
                      placeholder="Feet" 
                    />
                    <input 
                      type="number" 
                      value={localProfile.heightInches} 
                      onChange={(e) => setLocalProfile({ ...localProfile, heightInches: parseInt(e.target.value) || 0 })} 
                      className="w-1/2 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-amber-400 font-bold" 
                      placeholder="Inches" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Rig Length Only (Feet) <span className="text-slate-500">(For campsite pad)</span></label>
                  <input 
                    type="number" 
                    value={localProfile.lengthFeet} 
                    onChange={(e) => setLocalProfile({ ...localProfile, lengthFeet: parseInt(e.target.value) || 16 })} 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs" 
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Combined Length with Towing (Feet) <span className="text-amber-400">*Driving Total</span></label>
                  <input 
                    type="number" 
                    value={localProfile.combinedLengthFeet} 
                    onChange={(e) => setLocalProfile({ ...localProfile, combinedLengthFeet: parseInt(e.target.value) || 33 })} 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-amber-300 font-medium" 
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Gross Weight (GVWR in lbs)</label>
                  <input 
                    type="number" 
                    value={localProfile.weightLbs} 
                    onChange={(e) => setLocalProfile({ ...localProfile, weightLbs: parseInt(e.target.value) || 4300 })} 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs" 
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">
                    Towing Fuel Economy (Est. MPG) <span className="text-amber-400/80 font-medium">(~{safeFuelRange} mi safe range)</span>
                  </label>
                  <input 
                    type="number" 
                    min="1"
                    max="50"
                    value={localProfile.towingMpg ?? 10} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setLocalProfile({ ...localProfile, towingMpg: val === '' ? '' : parseInt(val, 10) || 0 });
                    }} 
                    onBlur={() => {
                      if (!localProfile.towingMpg || localProfile.towingMpg < 1) {
                        setLocalProfile({ ...localProfile, towingMpg: 10 });
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-amber-300 font-bold" 
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-emerald-400 border-b border-slate-700/60 pb-1 uppercase tracking-wider text-[11px]">2. Towing &amp; Auxiliary Setup</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Towing / Drive Setup</label>
                  <select 
                    value={localProfile.towSetup} 
                    onChange={(e) => setLocalProfile({ ...localProfile, towSetup: e.target.value })} 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs"
                  >
                    <option value="Trailer Towed by SUV, Truck, or Car">Trailer Towed by SUV, Truck, or Car (e.g. Jeep + Airstream)</option>
                    <option value="Flat Towing Car (Toad behind Motorhome)">Flat Towing Car behind Motorhome ("Toad")</option>
                    <option value="Car on Tow Dolly behind Motorhome">Car on Tow Dolly behind Motorhome</option>
                    <option value="None (Solo Motorhome / Camper Van)">None (Solo Motorhome or Camper Van)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-400 mb-1"><i className="fa-solid fa-fire-flame-simple text-orange-400 mr-1"></i> Propane Tank Configuration</label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="block text-[10px] text-slate-500">Style</span>
                      <select 
                        value={localProfile.propaneStyle} 
                        onChange={(e) => setLocalProfile({ ...localProfile, propaneStyle: e.target.value })} 
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs"
                      >
                        <option value="Portable Cylinders">Portable Cylinders</option>
                        <option value="ASME Tank">ASME Tank</option>
                      </select>
                    </div>

                    <div>
                      <span className="block text-[10px] text-slate-500">Number of Bins</span>
                      <input 
                        type="number" 
                        value={localProfile.propaneCount} 
                        onChange={(e) => setLocalProfile({ ...localProfile, propaneCount: parseInt(e.target.value) || 2 })} 
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs font-semibold text-orange-400" 
                      />
                    </div>

                    <div>
                      <span className="block text-[10px] text-slate-500">Pounds / Bin</span>
                      <input 
                        type="number" 
                        value={localProfile.propaneLb} 
                        onChange={(e) => setLocalProfile({ ...localProfile, propaneLb: parseInt(e.target.value) || 20 })} 
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs font-semibold text-orange-400" 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-emerald-400 border-b border-slate-700/60 pb-1 uppercase tracking-wider text-[11px]">3. Active Memberships &amp; Discounts</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {['Good Sam', 'Harvest Hosts', 'Boondockers W.', 'KOA Rewards', 'Passport America', 'BLM / America Beautiful'].map((mName) => (
                  <label key={mName} className="flex items-center space-x-2 bg-slate-900 p-2 rounded-xl border border-slate-700/80 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={localProfile.memberships.includes(mName)} 
                      onChange={(e) => {
                        const updated = e.target.checked 
                          ? [...localProfile.memberships, mName] 
                          : localProfile.memberships.filter(x => x !== mName);
                        setLocalProfile({ ...localProfile, memberships: updated });
                      }} 
                      className="rounded bg-slate-800 text-emerald-500" 
                    />
                    <span>{mName}</span>
                  </label>
                ))}
                <label className="flex items-center space-x-2 bg-slate-900 p-2 rounded-xl border border-slate-700/80 cursor-pointer sm:col-span-3">
                  <input type="checkbox" className="rounded bg-slate-800 text-emerald-500" />
                  <span className="font-medium text-emerald-300">Others... (Add Custom Program)</span>
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-emerald-400 border-b border-slate-700/60 pb-1 uppercase tracking-wider text-[11px]">4. Camping Preferences, Power, Battery &amp; Solar Setup</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Rig Electrical Rating</label>
                  <select 
                    value={localProfile.ampRating} 
                    onChange={(e) => setLocalProfile({ ...localProfile, ampRating: e.target.value })} 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs"
                  >
                    <option value="30A">30 Amp Service (Single AC / Standard Travel Trailer)</option>
                    <option value="50A">50 Amp Service (Dual ACs / Heavy Load)</option>
                    <option value="20A">15/20 Amp Standard Household</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Minimum Acceptable Hookup</label>
                  <select 
                    value={localProfile.minHookup} 
                    onChange={(e) => setLocalProfile({ ...localProfile, minHookup: e.target.value })} 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs"
                  >
                    <option value="full">Must Be Full Hookups (Water, Electric, Sewer)</option>
                    <option value="partial">Water &amp; Electric OK (Sewer at Dump Station)</option>
                    <option value="electric">Electric Only OK (Will fill water tank prior)</option>
                    <option value="dry">Dry Camping / Boondocking OK (Off-Grid)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-slate-700 bg-slate-800/80 flex justify-end gap-2 shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-medium">Cancel</button>
            <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs shadow-md transition flex items-center gap-1.5">
              <i className="fa-solid fa-floppy-disk"></i> Save Profile Specs
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
