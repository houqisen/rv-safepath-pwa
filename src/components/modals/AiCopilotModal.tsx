import React, { useState } from 'react';
import { RvProfile } from '../../types/rv';
import { AiPlanPreview } from '../../types/itinerary';
import { calculateTripDurationAndSeason } from '../../utils/dateUtils';
import { formatResolvedPlaceAddress } from '../../utils/addressUtils';
import { generateAiTripPlan } from '../../services/geminiService';

interface AiCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: RvProfile;
  userLocationName: string;
  hasExistingWaypoints: boolean;
  onApplyPlan: (plan: AiPlanPreview, mode: 'replace' | 'append', startDate?: string) => void;
}

export const AiCopilotModal: React.FC<AiCopilotModalProps> = ({
  isOpen,
  onClose,
  profile,
  userLocationName,
  hasExistingWaypoints,
  onApplyPlan
}) => {
  const [aiInputMode, setAiInputMode] = useState<'guided' | 'custom'>('guided');
  const [aiStartLocation, setAiStartLocation] = useState(userLocationName || "Bellevue, WA");
  const [aiDestinations, setAiDestinations] = useState("");
  const [aiDepartureDate, setAiDepartureDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [aiReturnDate, setAiReturnDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [aiVibeTags, setAiVibeTags] = useState<string[]>(['National Parks']);
  const [aiEnforce333, setAiEnforce333] = useState(true);
  const [aiIsRoundTrip, setAiIsRoundTrip] = useState(true);
  const [aiMaxDailyHours, setAiMaxDailyHours] = useState(5);
  const [aiCustomPrompt, setAiCustomPrompt] = useState("");
  const [isGeneratingTrip, setIsGeneratingTrip] = useState(false);
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);
  const [generatedPlanPreview, setGeneratedPlanPreview] = useState<AiPlanPreview | null>(null);

  if (!isOpen) return null;

  const combinedLen = profile.combinedLengthFeet || profile.lengthFeet;
  const formattedHeight = `${profile.heightFeet}' ${profile.heightInches}"`;
  const safeMpgDisplay = Number(profile.towingMpg) || 10;
  const safeFuelRange = safeMpgDisplay * 25;
  const { diffDays: calculatedDays, season: calculatedSeason } = calculateTripDurationAndSeason(aiDepartureDate, aiReturnDate);

  const handleDepartureDateChange = (val: string) => {
    if (!val) {
      setAiDepartureDate('');
      return;
    }
    const parts = val.split('-');
    if (parts.length === 3 && parts[0].length === 4 && parseInt(parts[0], 10) >= 2026) {
      setAiDepartureDate(val);
      if (aiReturnDate && aiReturnDate < val) {
        setAiReturnDate(val);
      }
    }
  };

  const handleReturnDateChange = (val: string) => {
    if (!val) {
      setAiReturnDate('');
      return;
    }
    const parts = val.split('-');
    if (parts.length === 3 && parts[0].length === 4 && parseInt(parts[0], 10) >= 2026) {
      setAiReturnDate(val);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGeneratingTrip(true);
    setAiErrorMessage(null);
    setGeneratedPlanPreview(null);

    try {
      const plan = await generateAiTripPlan({
        inputMode: aiInputMode,
        startLocation: aiStartLocation,
        destinations: aiDestinations,
        departureDate: aiDepartureDate,
        returnDate: aiReturnDate,
        vibeTags: aiVibeTags,
        enforce333: aiEnforce333,
        isRoundTrip: aiIsRoundTrip,
        maxDailyHours: aiMaxDailyHours,
        customPrompt: aiCustomPrompt,
        profile
      });
      setGeneratedPlanPreview({
        ...plan,
        tripStartDate: aiDepartureDate
      });
    } catch (err: any) {
      setAiErrorMessage(err.message || "Failed to generate plan.");
    } finally {
      setIsGeneratingTrip(false);
    }
  };

  const setupAiAutocomplete = (inputEl: HTMLInputElement | null) => {
    if (!inputEl || !window.google || !window.google.maps || !window.google.maps.places) return;
    if ((inputEl as any).__autocompleteAttached) return;

    try {
      const autocomplete = new window.google.maps.places.Autocomplete(inputEl);
      (inputEl as any).__autocompleteAttached = true;
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        const addr = formatResolvedPlaceAddress(place);
        if (addr) {
          setAiStartLocation(addr);
        }
      });
    } catch (e) {
      console.error("Autocomplete setup error:", e);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-to-br from-emerald-500 to-sky-500 text-white p-2 rounded-xl shadow">
              <i className="fa-solid fa-wand-magic-sparkles text-base"></i>
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                RV SafePath AI Copilot <span className="text-[10px] bg-sky-500/20 text-sky-300 font-semibold px-2 py-0.5 rounded-full border border-sky-500/30">Gemini Powered</span>
              </h3>
              <p className="text-xs text-slate-400">Multi-stop daily pacing, daylight safety &amp; dynamic rig profile matching.</p>
            </div>
          </div>
          <button onClick={() => { onClose(); setGeneratedPlanPreview(null); }} className="text-slate-400 hover:text-slate-200 text-lg p-1">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-slate-200 flex-1">
          {!generatedPlanPreview ? (
            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700">
                <button
                  type="button"
                  onClick={() => setAiInputMode('guided')}
                  className={`flex-1 py-1.5 rounded-lg font-semibold transition flex items-center justify-center gap-1.5 ${aiInputMode === 'guided' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <i className="fa-solid fa-list-check"></i> Guided Form
                </button>
                <button
                  type="button"
                  onClick={() => setAiInputMode('custom')}
                  className={`flex-1 py-1.5 rounded-lg font-semibold transition flex items-center justify-center gap-1.5 ${aiInputMode === 'custom' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <i className="fa-solid fa-pen-nib"></i> Custom Prompt
                </button>
              </div>

              {aiInputMode === 'guided' ? (
                <div className="space-y-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/70">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Starting Point (Origin)</label>
                      <input
                        ref={setupAiAutocomplete}
                        type="text"
                        value={aiStartLocation}
                        onChange={(e) => setAiStartLocation(e.target.value)}
                        placeholder="Search starting city, address or zip..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 flex items-center justify-between">
                        <span>Dream Destination(s)</span>
                        <span className="text-[10px] text-slate-500 font-normal">Single or multiple stops</span>
                      </label>
                      <input
                        type="text"
                        value={aiDestinations}
                        onChange={(e) => setAiDestinations(e.target.value)}
                        placeholder="e.g. Glacier NP, MT & Yellowstone NP, WY (or use -> for sequence)"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500"
                        required
                      />
                      <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                        <i className="fa-solid fa-lightbulb text-amber-400 text-[9px]"></i>
                        <span>{'Separate multiple destinations with "&" or "->" (e.g. "Banff, AB -> Jasper, AB").'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Departure Date</label>
                      <input
                        type="date"
                        min="2026-01-01"
                        value={aiDepartureDate}
                        onChange={(e) => handleDepartureDateChange(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">
                        Arrival / Return Date <span className="text-emerald-400 font-semibold">({calculatedDays} Days, {calculatedSeason})</span>
                      </label>
                      <input
                        type="date"
                        value={aiReturnDate}
                        min={aiDepartureDate || "2026-01-01"}
                        onChange={(e) => handleReturnDateChange(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Max Daily Driving Hours</label>
                    <select
                      value={aiMaxDailyHours}
                      onChange={(e) => setAiMaxDailyHours(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500"
                    >
                      {[2, 3, 4, 5, 6, 7, 8].map(h => (
                        <option key={h} value={h}>~{h} Hours / Day ({h * 50} mi/day)</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1.5">Travel Vibe &amp; Style</label>
                    <div className="flex flex-wrap gap-1.5">
                      {['National Parks', 'Coastal Scenic', 'Forest / Boondocking', 'Family Friendly', 'Pet Friendly', 'Wineries & Harvest Hosts'].map(tag => {
                        const selected = aiVibeTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              if (selected) setAiVibeTags(aiVibeTags.filter(t => t !== tag));
                              else setAiVibeTags([...aiVibeTags, tag]);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${selected ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <label className="flex items-start gap-2.5 cursor-pointer bg-slate-900/80 p-2.5 rounded-xl border border-slate-700">
                      <input
                        type="checkbox"
                        checked={aiIsRoundTrip}
                        onChange={(e) => setAiIsRoundTrip(e.target.checked)}
                        className="mt-0.5 rounded bg-slate-800 border-slate-600 text-emerald-500 focus:ring-0"
                      />
                      <div>
                        <span className="font-semibold text-slate-200 block text-xs">🔄 Round-Trip (Return to Starting Point)</span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {aiIsRoundTrip 
                            ? `Checked: Plan outbound and return legs to return back to ${aiStartLocation || userLocationName}.` 
                            : "Unchecked: Plan a one-way trip ending at the final destination."}
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer bg-slate-900/80 p-2.5 rounded-xl border border-slate-700">
                      <input
                        type="checkbox"
                        checked={aiEnforce333}
                        onChange={(e) => setAiEnforce333(e.target.checked)}
                        className="mt-0.5 rounded bg-slate-800 border-slate-600 text-emerald-500 focus:ring-0"
                      />
                      <div>
                        <span className="font-semibold text-slate-200 block text-xs">Enforce 3-3-3 Rule (&le;300 mi/day, &lt;3:00 PM arrival, &ge;3 nights stay)</span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {aiEnforce333 
                            ? "Checked: AI structures the route with comfortable daily driving limits and camp pacing." 
                            : "Unchecked: No fixed pacing rules enforced; AI plans freely around your requested destinations."}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/70">
                  <div>
                    <label className="block text-slate-300 font-semibold text-xs mb-1">Describe Your Dream RV Trip</label>
                    <textarea
                      rows={4}
                      value={aiCustomPrompt}
                      onChange={(e) => setAiCustomPrompt(e.target.value)}
                      placeholder="e.g., I want to take 7 days to Denver and back home with my RV. Note: every day I don't want to drive more than 5 hours unless it is impossible to complete within 7 days."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:border-emerald-500"
                      required
                    />
                    <p className="text-[11px] text-slate-400 italic mt-1">
                      The AI automatically detects round-trip intents ("and back home"), groups daytime breaks as stops, and calculates time-budget pacing.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800">
                    <label className="block text-slate-400 mb-1 text-[11px] font-medium">Trip Start Date (Departure)</label>
                    <input
                      type="date"
                      min="2026-01-01"
                      value={aiDepartureDate}
                      onChange={(e) => handleDepartureDateChange(e.target.value)}
                      className="w-full sm:w-1/2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-emerald-500"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/60 text-[11px] text-slate-400 space-y-1">
                <div className="text-slate-300 font-semibold flex items-center gap-1.5 text-xs">
                  <i className="fa-solid fa-shield-halved text-emerald-400"></i> RV Guard &amp; Fuel Safety Active:
                </div>
                <div>Max Height: <strong className="text-amber-400">{formattedHeight}</strong> | Combined Length: <strong className="text-slate-200">{combinedLen}ft</strong> | Weight: <strong className="text-slate-200">{profile.weightLbs.toLocaleString()} lbs</strong></div>
                <div>Towing Economy: <strong className="text-amber-300">{safeMpgDisplay} MPG</strong> (~{safeFuelRange} mi safe range) | Power: <strong className="text-emerald-400">{profile.ampRating}</strong> | Min Hookup: <strong className="text-sky-300">{profile.minHookup.toUpperCase()}</strong></div>
              </div>

              {aiErrorMessage && (
                <div className="bg-red-500/15 border border-red-500/30 text-red-300 text-xs p-3 rounded-xl flex items-start gap-2">
                  <i className="fa-solid fa-circle-exclamation text-red-400 shrink-0 mt-0.5"></i>
                  <span>{aiErrorMessage}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={() => onClose()}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGeneratingTrip}
                  className="bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white font-semibold px-5 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg transition disabled:opacity-50"
                >
                  {isGeneratingTrip ? (
                    <>
                      <i className="fa-solid fa-circle-notch animate-spin"></i>
                      <span>Planning Multi-Stop Route...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-wand-magic-sparkles text-amber-300"></i>
                      <span>Generate RV Itinerary</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 space-y-1">
                <h4 className="font-bold text-sm text-emerald-400 flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-check"></i> {generatedPlanPreview.tripTitle || "Generated RV Itinerary"}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">{generatedPlanPreview.summary}</p>
              </div>

              {generatedPlanPreview.feasibilityWarning && (
                <div className="bg-amber-500/15 border border-amber-500/40 rounded-xl p-3 space-y-1.5 text-xs text-amber-300">
                  <div className="font-bold flex items-center gap-1.5 text-amber-400">
                    <i className="fa-solid fa-triangle-exclamation"></i> Driving Pacing &amp; Feasibility Notice:
                  </div>
                  <p className="leading-relaxed text-[11px] text-amber-200">{generatedPlanPreview.feasibilityWarning}</p>
                </div>
              )}

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {(() => {
                  let previewRunningDay = 1;
                  return generatedPlanPreview.waypoints?.map((wp: any, idx: number) => {
                    const previewDay = previewRunningDay;
                    const previewStay = wp.stayNights !== undefined ? wp.stayNights : 1;
                    previewRunningDay += (previewStay > 0 ? previewStay : 1);

                    const stops = wp.stops || [{ destination: wp.destination }];
                    const finalStop = stops[stops.length - 1];

                    return (
                      <div key={idx} className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-3 space-y-1.5 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-emerald-400">DAY {previewDay}</span>
                          <span className="text-slate-400 bg-slate-800 px-2 py-0.5 rounded text-[10px]">
                            Stay: {previewStay === 0 ? '0 Nights (Return Home)' : `${previewStay} Night${previewStay > 1 ? 's' : ''}`}
                          </span>
                        </div>
                        <div className="text-slate-200">
                          <strong className="text-slate-400">From:</strong> {wp.origin} &rarr; <strong className="text-emerald-300">Overnight Destination:</strong> {finalStop.destination}
                        </div>
                        {stops.length > 1 && (
                          <div className="text-[11px] text-slate-400 pl-2 border-l border-slate-700 space-y-0.5">
                            <span className="font-semibold text-slate-300">Includes Daytime Stops:</span>
                            {stops.slice(0, -1).map((s: any, sIdx: number) => (
                              <div key={sIdx}>• {s.destination}</div>
                            ))}
                          </div>
                        )}
                        {wp.notes && (
                          <div className="text-[11px] text-slate-400 italic pt-0.5">{wp.notes}</div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              <div className="bg-slate-900/50 p-2.5 rounded-xl border border-slate-700/60 text-[11px] text-slate-400">
                <i className="fa-solid fa-info-circle text-sky-400 mr-1"></i> Once applied, all legs will calculate exact Google Maps miles, daylight arrival times, and live weather for every stop.
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setGeneratedPlanPreview(null)}
                  className="w-full sm:w-auto px-3.5 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-medium"
                >
                  &larr; Back to Generator
                </button>
                {hasExistingWaypoints && (
                  <button
                    type="button"
                    onClick={() => { onApplyPlan(generatedPlanPreview, 'append', generatedPlanPreview.tripStartDate || aiDepartureDate); onClose(); setGeneratedPlanPreview(null); }}
                    className="w-full sm:w-auto px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-xl text-xs transition shadow flex items-center justify-center gap-1.5"
                  >
                    <i className="fa-solid fa-plus"></i> Append to Current Plan
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { onApplyPlan(generatedPlanPreview, 'replace', generatedPlanPreview.tripStartDate || aiDepartureDate); onClose(); setGeneratedPlanPreview(null); }}
                  className="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs transition shadow flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-check"></i> Replace Current Itinerary
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
