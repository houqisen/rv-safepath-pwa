import React from 'react';
import { RvProfile } from '../../types/rv';
import { RvCampsiteRecommendation, RvSitePickerResults } from '../../types/places';

interface RvSitePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  destination: string;
  stayNights: number;
  profile: RvProfile;
  isLoading: boolean;
  error: string | null;
  results: RvSitePickerResults | null;
  onRetry: () => void;
  onSelectSite: (site: RvCampsiteRecommendation) => void;
}

export const RvSitePickerModal: React.FC<RvSitePickerModalProps> = ({
  isOpen,
  onClose,
  destination,
  stayNights,
  profile,
  isLoading,
  error,
  results,
  onRetry,
  onSelectSite
}) => {
  if (!isOpen) return null;

  const combinedLen = profile.combinedLengthFeet || profile.lengthFeet;
  const formattedHeight = `${profile.heightFeet}' ${profile.heightInches}"`;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/95 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="bg-emerald-500/20 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/30">
              <i className="fa-solid fa-campground text-lg"></i>
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                Top 3 Recommended RV Campsites
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  RV Profile Matched
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Location: <strong className="text-emerald-300">{destination}</strong> ({stayNights} Nights) · Matched for {combinedLen}ft combined rig, {formattedHeight} clearance &amp; {profile.ampRating} service
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-200 text-lg p-1"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-slate-200 flex-1">
          {isLoading ? (
            <div className="text-center py-16 space-y-3">
              <i className="fa-solid fa-compass animate-spin text-3xl text-emerald-400"></i>
              <div className="font-bold text-sm text-slate-200">Evaluating RV Campsites for {destination}...</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Analyzing highway turn approach ease, campsite pad lengths ({combinedLen}ft), Full Hookups (FHU) / 30A/50A electrical pedestals, Starlink sky clearance &amp; season availability.
              </p>
            </div>
          ) : error ? (
            <div className="bg-red-500/15 border border-red-500/30 text-red-300 text-xs p-4 rounded-xl space-y-3 max-w-lg mx-auto text-center">
              <i className="fa-solid fa-circle-exclamation text-2xl text-red-400"></i>
              <div>{error}</div>
              <button
                onClick={onRetry}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-semibold text-slate-200 transition"
              >
                Retry Search
              </button>
            </div>
          ) : results && results.sites ? (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/80">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-800/80 text-slate-300">
                      <th className="p-3 font-bold w-36 sm:w-44 shrink-0">Comparison Factor</th>
                      {results.sites.map((site, idx) => (
                        <th key={idx} className="p-3 font-bold border-l border-slate-700/80 min-w-[200px] sm:min-w-[240px]">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-emerald-400 font-bold">Option {idx + 1}</span>
                            {idx === 0 && (
                              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] px-1.5 py-0.5 rounded font-bold">
                                ⭐ Top Pick
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-bold text-slate-100 mt-1">{site.name}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{site.category}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    <tr>
                      <td className="p-3 font-semibold text-slate-400 bg-slate-900/50">📍 Proximity &amp; Town</td>
                      {results.sites.map((site, idx) => (
                        <td key={idx} className="p-3 border-l border-slate-800 text-slate-200">{site.proximity}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-400 bg-slate-900/50">🏔️ View &amp; Atmosphere</td>
                      {results.sites.map((site, idx) => (
                        <td key={idx} className="p-3 border-l border-slate-800 text-slate-200">{site.viewSetting}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-400 bg-slate-900/50">📐 Pad Type &amp; Fit</td>
                      {results.sites.map((site, idx) => (
                        <td key={idx} className="p-3 border-l border-slate-800 font-medium text-emerald-300">{site.padType}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-400 bg-slate-900/50">🔌 Hookups &amp; Utilities (FHU)</td>
                      {results.sites.map((site, idx) => {
                        const isFHU = site.hookups?.toLowerCase().includes('full hookup') || site.hookups?.toLowerCase().includes('fhu');
                        return (
                          <td key={idx} className="p-3 border-l border-slate-800">
                            <div className={`font-semibold flex items-center gap-1.5 ${isFHU ? 'text-emerald-300' : 'text-sky-300'}`}>
                              <span>{isFHU ? '✅' : '🔌'}</span>
                              <span>{site.hookups}</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-400 bg-slate-900/50">🛣️ Driving &amp; Turn Ease</td>
                      {results.sites.map((site, idx) => (
                        <td key={idx} className="p-3 border-l border-slate-800 text-amber-300 font-medium">{site.turnEase}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-400 bg-slate-900/50">🛰️ Starlink &amp; Signal</td>
                      {results.sites.map((site, idx) => (
                        <td key={idx} className="p-3 border-l border-slate-800 text-slate-300">{site.connectivity}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-400 bg-slate-900/50">🐕 Amenities &amp; Pets</td>
                      {results.sites.map((site, idx) => (
                        <td key={idx} className="p-3 border-l border-slate-800 text-slate-300">{site.amenities}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-400 bg-slate-900/50">💲 Est. Rates &amp; Clubs</td>
                      {results.sites.map((site, idx) => (
                        <td key={idx} className="p-3 border-l border-slate-800 text-slate-200">{site.priceDiscounts}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-400 bg-slate-900/50">🏆 Best For</td>
                      {results.sites.map((site, idx) => (
                        <td key={idx} className="p-3 border-l border-slate-800 font-bold text-emerald-400">{site.bestFor}</td>
                      ))}
                    </tr>
                    <tr className="bg-slate-800/40">
                      <td className="p-3 font-semibold text-slate-400 bg-slate-900/50">Action</td>
                      {results.sites.map((site, idx) => (
                        <td key={idx} className="p-3 border-l border-slate-800">
                          <button
                            type="button"
                            onClick={() => onSelectSite(site)}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition"
                          >
                            <i className="fa-solid fa-check"></i> Select &amp; Apply
                          </button>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>

        <div className="p-3.5 border-t border-slate-700 bg-slate-800/90 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
