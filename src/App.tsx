import React, { useState, useEffect, useCallback } from 'react';
import { RvProfile } from './types/rv';
import { Waypoint, WaypointStop, AiPlanPreview, DestinationWeather } from './types/itinerary';
import { ChecklistTask } from './types/checklist';
import { RvCampsiteRecommendation, RvSitePickerResults } from './types/places';
import { DEFAULT_PROFILE } from './constants/profileDefaults';
import { INITIAL_DEPARTURE_TASKS, INITIAL_ARRIVAL_TASKS } from './constants/checklistDefaults';
import { fetchLiveWeatherForStops } from './services/weatherService';
import { fetchRvSitePickerRecommendations } from './services/geminiService';
import { calculateWaypointMetricsService } from './services/directionsService';

import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { InTimeFinderTab } from './components/tabs/InTimeFinderTab';
import { SafeRouterTab } from './components/tabs/SafeRouterTab';
import { TripPlannerTab } from './components/tabs/TripPlannerTab';
import { ChecklistsTab } from './components/tabs/ChecklistsTab';
import { AiCopilotModal } from './components/modals/AiCopilotModal';
import { RvSitePickerModal } from './components/modals/RvSitePickerModal';
import { RvProfileModal } from './components/modals/RvProfileModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<'finder' | 'router' | 'planner' | 'checklists'>('planner');

  // RV Profile State
  const [profile, setProfile] = useState<RvProfile>(() => {
    try {
      const saved = localStorage.getItem('rv_profile');
      return saved ? JSON.parse(saved) : DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  });

  // User Location State
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>({ lat: 47.6101, lng: -122.2015 });
  const [userLocationName, setUserLocationName] = useState("Bellevue, WA");

  // Itinerary & Waypoints State
  const [waypoints, setWaypoints] = useState<Waypoint[]>(() => {
    try {
      const saved = localStorage.getItem('rv_waypoints');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Weather State
  const [destinationWeathers, setDestinationWeathers] = useState<Record<string, DestinationWeather>>({});

  // Checklists State
  const [departureTasks, setDepartureTasks] = useState<ChecklistTask[]>(() => {
    try {
      const saved = localStorage.getItem('departure_tasks');
      return saved ? JSON.parse(saved) : INITIAL_DEPARTURE_TASKS;
    } catch {
      return INITIAL_DEPARTURE_TASKS;
    }
  });

  const [arrivalTasks, setArrivalTasks] = useState<ChecklistTask[]>(() => {
    try {
      const saved = localStorage.getItem('arrival_tasks');
      return saved ? JSON.parse(saved) : INITIAL_ARRIVAL_TASKS;
    } catch {
      return INITIAL_ARRIVAL_TASKS;
    }
  });

  // Modals Visibility State
  const [isAiCopilotOpen, setIsAiCopilotOpen] = useState(false);
  const [isRvProfileOpen, setIsRvProfileOpen] = useState(false);
  const [sitePickerState, setSitePickerState] = useState<{
    isOpen: boolean;
    destination: string;
    stayNights: number;
    wpId: number;
    stopIdx: number;
    isLoading: boolean;
    error: string | null;
    results: RvSitePickerResults | null;
  }>({
    isOpen: false,
    destination: '',
    stayNights: 1,
    wpId: 0,
    stopIdx: 0,
    isLoading: false,
    error: null,
    results: null
  });

  // Geolocation Setup
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => {
          console.log("Using default Bellevue, WA location coordinates.");
        }
      );
    }
  }, []);

  // Sync Profile to LocalStorage
  const handleSaveProfile = (updated: RvProfile) => {
    setProfile(updated);
    localStorage.setItem('rv_profile', JSON.stringify(updated));
  };

  // Sync Checklists to LocalStorage
  useEffect(() => {
    localStorage.setItem('departure_tasks', JSON.stringify(departureTasks));
  }, [departureTasks]);

  useEffect(() => {
    localStorage.setItem('arrival_tasks', JSON.stringify(arrivalTasks));
  }, [arrivalTasks]);

  // Sync Waypoints to LocalStorage
  useEffect(() => {
    localStorage.setItem('rv_waypoints', JSON.stringify(waypoints));
  }, [waypoints]);

  // Recalculate Waypoint Metrics when stops/origins change
  useEffect(() => {
    waypoints.forEach((wp) => {
      calculateWaypointMetricsService(wp, (calculatedWp) => {
        setWaypoints(prev => prev.map(item => item.id === calculatedWp.id ? calculatedWp : item));
      });
    });
  }, [waypoints.map(w => `${w.origin}->${w.stops.map(s => s.destination).join(',')}`).join('|')]);

  // Fetch Live Weather for Stops
  useEffect(() => {
    fetchLiveWeatherForStops(waypoints, destinationWeathers).then(newWeathers => {
      if (Object.keys(newWeathers).length > 0) {
        setDestinationWeathers(prev => ({ ...prev, ...newWeathers }));
      }
    });
  }, [waypoints]);

  // AI Copilot Plan Handler
  const handleApplyAiPlan = (plan: AiPlanPreview, mode: 'replace' | 'append') => {
    const newWaypoints: Waypoint[] = plan.waypoints.map((item: any, idx: number) => {
      let stopsList: WaypointStop[] = [];
      if (item.stops && Array.isArray(item.stops) && item.stops.length > 0) {
        stopsList = item.stops.map((s: any, sIdx: number) => ({
          id: Date.now() + idx * 100 + sIdx,
          destination: s.destination || '',
          depHour: s.depHour !== undefined ? s.depHour : (sIdx === 0 ? 8 : 12),
          depMin: s.depMin !== undefined ? s.depMin : 0,
          depAmPm: s.depAmPm || (sIdx === 0 ? 'AM' : 'PM'),
          estMiles: 0,
          estHours: 0,
          arrivalHour: 15,
          arrivalMinute: 0
        }));
      } else if (item.destination) {
        stopsList = [{
          id: Date.now() + idx * 100,
          destination: item.destination,
          depHour: item.depHour !== undefined ? item.depHour : 8,
          depMin: item.depMin !== undefined ? item.depMin : 0,
          depAmPm: item.depAmPm || 'AM',
          estMiles: 0,
          estHours: 0,
          arrivalHour: 15,
          arrivalMinute: 0
        }];
      }

      return {
        id: Date.now() + idx * 1000,
        origin: item.origin || '',
        isExpanded: true,
        isHomeReturn: !!item.isHomeReturn,
        stops: stopsList,
        notes: item.notes || '',
        stayNights: item.stayNights !== undefined ? item.stayNights : 1,
        estMiles: 0,
        estHours: 0,
        arrivalHour: 15,
        arrivalMinute: 0
      };
    });

    if (mode === 'replace') {
      setWaypoints(newWaypoints);
    } else {
      setWaypoints(prev => [...prev, ...newWaypoints]);
    }
  };

  // RV Site Picker Handlers
  const handleOpenSitePicker = useCallback((destination: string, stayNights: number, wpId: number, stopIdx: number) => {
    setSitePickerState({
      isOpen: true,
      destination,
      stayNights,
      wpId,
      stopIdx,
      isLoading: true,
      error: null,
      results: null
    });

    fetchRvSitePickerRecommendations({ destination, stayNights, profile })
      .then(results => {
        setSitePickerState(prev => ({ ...prev, isLoading: false, results }));
      })
      .catch(err => {
        setSitePickerState(prev => ({ ...prev, isLoading: false, error: err.message || "Failed to load campsites." }));
      });
  }, [profile]);

  const handleSelectCampsite = (site: RvCampsiteRecommendation) => {
    const { wpId, stopIdx } = sitePickerState;
    setWaypoints(prev => prev.map(wp => {
      if (wp.id !== wpId) return wp;
      const updatedStops = [...wp.stops];
      if (updatedStops[stopIdx]) {
        updatedStops[stopIdx] = {
          ...updatedStops[stopIdx],
          destination: site.name ? `${site.name}, ${site.address}` : site.address
        };
      }
      const newNotes = wp.notes 
        ? `${wp.notes}\n• Recommended RV Site: ${site.name} (${site.hookups}, ${site.padType}). ${site.bestFor}.` 
        : `• Recommended RV Site: ${site.name} (${site.hookups}, ${site.padType}). ${site.bestFor}.`;
      return { ...wp, stops: updatedStops, notes: newNotes };
    }));
    setSitePickerState(prev => ({ ...prev, isOpen: false }));
  };

  // Waypoint Management Handlers
  const handleAddWaypoint = () => {
    const lastWp = waypoints[waypoints.length - 1];
    const lastStop = lastWp?.stops?.[lastWp.stops.length - 1];
    const nextOrigin = lastStop?.destination || userLocationName || "Bellevue, WA";

    const newWp: Waypoint = {
      id: Date.now(),
      origin: nextOrigin,
      isExpanded: true,
      isHomeReturn: false,
      stops: [
        {
          id: Date.now() + 1,
          destination: '',
          depHour: 8,
          depMin: 0,
          depAmPm: 'AM',
          estMiles: 0,
          estHours: 0,
          arrivalHour: 15,
          arrivalMinute: 0
        }
      ],
      notes: '',
      stayNights: 1,
      estMiles: 0,
      estHours: 0,
      arrivalHour: 15,
      arrivalMinute: 0
    };
    setWaypoints(prev => [...prev, newWp]);
  };

  const handleClearAllWaypoints = () => {
    if (window.confirm("Are you sure you want to clear all travel days from your itinerary?")) {
      setWaypoints([]);
    }
  };

  const handleUpdateWaypoint = (wpId: number, updater: (wp: Waypoint) => Waypoint) => {
    setWaypoints(prev => prev.map(wp => wp.id === wpId ? updater(wp) : wp));
  };

  const handleRemoveWaypoint = (wpId: number) => {
    setWaypoints(prev => prev.filter(wp => wp.id !== wpId));
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-hidden">
      {/* Top Header */}
      <Header profile={profile} onOpenProfile={() => setIsRvProfileOpen(true)} />

      {/* Main Content Layout */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} profile={profile} />

        {/* Tab Views */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-950">
          {activeTab === 'finder' && (
            <InTimeFinderTab
              profile={profile}
              userCoords={userCoords}
              userLocationName={userLocationName}
              setUserCoords={setUserCoords}
              setUserLocationName={setUserLocationName}
            />
          )}

          {activeTab === 'router' && (
            <SafeRouterTab
              profile={profile}
              userCoords={userCoords}
              userLocationName={userLocationName}
            />
          )}

          {activeTab === 'planner' && (
            <TripPlannerTab
              waypoints={waypoints}
              destinationWeathers={destinationWeathers}
              profile={profile}
              onOpenAiCopilot={() => setIsAiCopilotOpen(true)}
              onOpenSitePicker={handleOpenSitePicker}
              onAddWaypoint={handleAddWaypoint}
              onClearAll={handleClearAllWaypoints}
              onUpdateWaypoint={handleUpdateWaypoint}
              onRemoveWaypoint={handleRemoveWaypoint}
            />
          )}

          {activeTab === 'checklists' && (
            <ChecklistsTab
              departureTasks={departureTasks}
              arrivalTasks={arrivalTasks}
              onToggleDepartureTask={(id) => setDepartureTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))}
              onToggleArrivalTask={(id) => setArrivalTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))}
              onAddDepartureTask={(text) => setDepartureTasks(prev => [...prev, { id: `d_${Date.now()}`, text, done: false }])}
              onAddArrivalTask={(text) => setArrivalTasks(prev => [...prev, { id: `a_${Date.now()}`, text, done: false }])}
              onDeleteDepartureTask={(id) => setDepartureTasks(prev => prev.filter(t => t.id !== id))}
              onDeleteArrivalTask={(id) => setArrivalTasks(prev => prev.filter(t => t.id !== id))}
              onClearDepartureTasks={() => setDepartureTasks(INITIAL_DEPARTURE_TASKS)}
              onClearArrivalTasks={() => setArrivalTasks(INITIAL_ARRIVAL_TASKS)}
            />
          )}
        </main>
      </div>

      {/* Interactive Modals */}
      <AiCopilotModal
        isOpen={isAiCopilotOpen}
        onClose={() => setIsAiCopilotOpen(false)}
        profile={profile}
        userLocationName={userLocationName}
        hasExistingWaypoints={waypoints.length > 0}
        onApplyPlan={handleApplyAiPlan}
      />

      <RvSitePickerModal
        isOpen={sitePickerState.isOpen}
        onClose={() => setSitePickerState(prev => ({ ...prev, isOpen: false }))}
        destination={sitePickerState.destination}
        stayNights={sitePickerState.stayNights}
        profile={profile}
        isLoading={sitePickerState.isLoading}
        error={sitePickerState.error}
        results={sitePickerState.results}
        onRetry={() => handleOpenSitePicker(sitePickerState.destination, sitePickerState.stayNights, sitePickerState.wpId, sitePickerState.stopIdx)}
        onSelectSite={handleSelectCampsite}
      />

      <RvProfileModal
        isOpen={isRvProfileOpen}
        onClose={() => setIsRvProfileOpen(false)}
        profile={profile}
        onSaveProfile={handleSaveProfile}
      />
    </div>
  );
}
