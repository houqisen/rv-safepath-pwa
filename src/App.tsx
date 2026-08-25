import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RvProfile } from './types/rv';
import { Waypoint, WaypointStop, AiPlanPreview, DestinationWeather } from './types/itinerary';
import { ChecklistTask } from './types/checklist';
import { RvCampsiteRecommendation, RvSitePickerResults } from './types/places';
import { DEFAULT_PROFILE } from './constants/profileDefaults';
import { INITIAL_DEPARTURE_TASKS, INITIAL_ARRIVAL_TASKS } from './constants/checklistDefaults';
import { fetchLiveWeatherForStops } from './services/weatherService';
import { fetchRvSitePickerRecommendations } from './services/geminiService';
import { calculateWaypointMetricsService } from './services/directionsService';
import { AuthUser, signOutUser, onAuthChange } from './services/authService';
import {
  saveUserProfileToCloud,
  loadUserProfileFromCloud,
  saveUserWaypointsToCloud,
  loadUserWaypointsFromCloud,
  saveUserChecklistsToCloud,
  loadUserChecklistsFromCloud,
  subscribeToUserCloudData
} from './services/cloudStorageService';
import { cleanAddressForNavigation } from './utils/addressUtils';

import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { InTimeFinderTab } from './components/tabs/InTimeFinderTab';
import { SafeRouterTab } from './components/tabs/SafeRouterTab';
import { TripPlannerTab } from './components/tabs/TripPlannerTab';
import { ChecklistsTab } from './components/tabs/ChecklistsTab';
import { AiCopilotModal } from './components/modals/AiCopilotModal';
import { RvSitePickerModal } from './components/modals/RvSitePickerModal';
import { RvProfileModal } from './components/modals/RvProfileModal';
import { AuthModal } from './components/modals/AuthModal';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

export default function App() {
  const [activeTab, setActiveTab] = useState<'intime' | 'router' | 'planner' | 'checklist'>('intime');
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  // Authentication State
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const isInitialSyncDone = useRef(false);

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
  const [userLocationName, setUserLocationName] = useState("");

  // Itinerary & Waypoints State
  const [waypoints, setWaypoints] = useState<Waypoint[]>(() => {
    try {
      const saved = localStorage.getItem('rv_waypoints');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [tripStartDate, setTripStartDate] = useState<string>(() => {
    try {
      return localStorage.getItem('rv_trip_start_date') || '';
    } catch {
      return '';
    }
  });

  // Weather State
  const [destinationWeathers, setDestinationWeathers] = useState<Record<string, DestinationWeather>>({});
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

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

  // Listen to Authentication State
  useEffect(() => {
    const unsubscribe = onAuthChange((currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        isInitialSyncDone.current = false;
      }
    });
    return () => unsubscribe();
  }, []);

  // Initial Cloud Load, Guest-to-Cloud Migration & Real-Time Sync Subscription
  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    setIsSyncing(true);

    async function initializeUserCloudData() {
      if (!user) return;
      try {
        // 1. Load or migrate RV Profile
        const cloudProfile = await loadUserProfileFromCloud(user.uid);
        if (cloudProfile && isMounted) {
          setProfile(cloudProfile);
          localStorage.setItem('rv_profile', JSON.stringify(cloudProfile));
        } else if (!cloudProfile) {
          await saveUserProfileToCloud(user.uid, profile);
        }

        // 2. Load or migrate Itinerary Waypoints & Start Date
        const cloudItinerary = await loadUserWaypointsFromCloud(user.uid);
        if (cloudItinerary && isMounted) {
          setWaypoints(cloudItinerary.waypoints);
          localStorage.setItem('rv_waypoints', JSON.stringify(cloudItinerary.waypoints));
          if (cloudItinerary.tripStartDate) {
            setTripStartDate(cloudItinerary.tripStartDate);
            localStorage.setItem('rv_trip_start_date', cloudItinerary.tripStartDate);
          }
        } else if (!cloudItinerary && waypoints.length > 0) {
          await saveUserWaypointsToCloud(user.uid, waypoints, tripStartDate);
        }

        // 3. Load or migrate Checklists
        const cloudChecklists = await loadUserChecklistsFromCloud(user.uid);
        if (cloudChecklists && isMounted) {
          setDepartureTasks(cloudChecklists.departureTasks);
          setArrivalTasks(cloudChecklists.arrivalTasks);
          localStorage.setItem('departure_tasks', JSON.stringify(cloudChecklists.departureTasks));
          localStorage.setItem('arrival_tasks', JSON.stringify(cloudChecklists.arrivalTasks));
        } else if (!cloudChecklists) {
          await saveUserChecklistsToCloud(user.uid, departureTasks, arrivalTasks);
        }

        if (isMounted) {
          isInitialSyncDone.current = true;
          setIsSyncing(false);
        }
      } catch (err) {
        console.error("Cloud data initialization error:", err);
        if (isMounted) setIsSyncing(false);
      }
    }

    initializeUserCloudData();

    // Subscribe to live Firestore changes across multiple devices
    const unsubscribeSync = subscribeToUserCloudData(user.uid, {
      onProfileUpdate: (updatedProf) => {
        if (isMounted && isInitialSyncDone.current) {
          setProfile(updatedProf);
          localStorage.setItem('rv_profile', JSON.stringify(updatedProf));
        }
      },
      onWaypointsUpdate: (updatedWps, updatedStartDate) => {
        if (isMounted && isInitialSyncDone.current) {
          setWaypoints(updatedWps);
          localStorage.setItem('rv_waypoints', JSON.stringify(updatedWps));
          if (updatedStartDate !== undefined) {
            setTripStartDate(updatedStartDate);
            localStorage.setItem('rv_trip_start_date', updatedStartDate);
          }
        }
      },
      onChecklistsUpdate: ({ departureTasks: dTasks, arrivalTasks: aTasks }) => {
        if (isMounted && isInitialSyncDone.current) {
          setDepartureTasks(dTasks);
          setArrivalTasks(aTasks);
          localStorage.setItem('departure_tasks', JSON.stringify(dTasks));
          localStorage.setItem('arrival_tasks', JSON.stringify(aTasks));
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribeSync();
    };
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (err: any) {
      console.error("Sign Out Error:", err);
    }
  };

  // Dynamic Google Maps Script & FontAwesome Loader
  useEffect(() => {
    if (!document.getElementById('fa-cdn-css')) {
      const link = document.createElement('link');
      link.id = 'fa-cdn-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
      document.head.appendChild(link);
    }

    if (!document.getElementById('pac-custom-style')) {
      const style = document.createElement('style');
      style.id = 'pac-custom-style';
      style.innerHTML = `.pac-container { z-index: 100000 !important; }`;
      document.head.appendChild(style);
    }

    if (window.google && window.google.maps) {
      setIsGoogleLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => setIsGoogleLoaded(true);
    script.onerror = () => setIsGoogleLoaded(false);
    document.head.appendChild(script);
  }, []);

  // Geolocation Setup
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLat = position.coords.latitude;
          const newLng = position.coords.longitude;
          setUserCoords({
            lat: newLat,
            lng: newLng
          });

          if (window.google && window.google.maps) {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: { lat: newLat, lng: newLng } }, (results, status) => {
              if (status === 'OK' && results && results[0]) {
                const addr = cleanAddressForNavigation(results[0].formatted_address);
                setUserLocationName(addr);
              }
            });
          }
        },
        () => {
          console.log("Using default fallback coordinates.");
        }
      );
    }
  }, [isGoogleLoaded]);

  // Sync Profile to LocalStorage & Cloud Firestore
  const handleSaveProfile = (updated: RvProfile) => {
    setProfile(updated);
    localStorage.setItem('rv_profile', JSON.stringify(updated));
    if (user && isInitialSyncDone.current) {
      saveUserProfileToCloud(user.uid, updated).catch(err => console.error("Cloud profile save error:", err));
    }
  };

  // Debounced Sync Checklists to LocalStorage & Cloud Firestore
  useEffect(() => {
    localStorage.setItem('departure_tasks', JSON.stringify(departureTasks));
    localStorage.setItem('arrival_tasks', JSON.stringify(arrivalTasks));
    if (!user || !isInitialSyncDone.current) return;

    const timer = setTimeout(() => {
      saveUserChecklistsToCloud(user.uid, departureTasks, arrivalTasks).catch(err => console.error("Cloud checklists save error:", err));
    }, 800);

    return () => clearTimeout(timer);
  }, [departureTasks, arrivalTasks, user]);

  // Debounced Sync Waypoints & Start Date to LocalStorage & Cloud Firestore
  useEffect(() => {
    localStorage.setItem('rv_waypoints', JSON.stringify(waypoints));
    localStorage.setItem('rv_trip_start_date', tripStartDate);
    if (!user || !isInitialSyncDone.current) return;

    const timer = setTimeout(() => {
      saveUserWaypointsToCloud(user.uid, waypoints, tripStartDate).catch(err => console.error("Cloud waypoints save error:", err));
    }, 800);

    return () => clearTimeout(timer);
  }, [waypoints, tripStartDate, user]);

  // Debounced Recalculate Waypoint Metrics (Wait 600ms after user pauses typing or changes stops)
  useEffect(() => {
    if (!isGoogleLoaded || waypoints.length === 0) return;

    const timer = setTimeout(() => {
      waypoints.forEach((wp) => {
        // Only run routing calculation if origin and at least one destination are non-empty
        const hasValidOrigin = !!wp.origin && wp.origin.trim().length > 2;
        const hasValidStop = wp.stops && wp.stops.some(s => !!s.destination && s.destination.trim().length > 2);
        if (hasValidOrigin && hasValidStop) {
          calculateWaypointMetricsService(wp, (calculatedWp) => {
            setWaypoints(prev => prev.map(item => item.id === calculatedWp.id ? calculatedWp : item));
          });
        }
      });
    }, 600);

    return () => clearTimeout(timer);
  }, [
    isGoogleLoaded,
    waypoints.map(w => `${w.origin}->${w.stops.map(s => `${s.destination}@${s.depHour}:${s.depMin}${s.depAmPm}`).join(',')}`).join('|')
  ]);

  // Debounced Fetch Live Weather for Stops
  const handleFetchWeather = useCallback(() => {
    setIsLoadingWeather(true);
    fetchLiveWeatherForStops(waypoints, destinationWeathers).then(newWeathers => {
      if (Object.keys(newWeathers).length > 0) {
        setDestinationWeathers(prev => ({ ...prev, ...newWeathers }));
      }
      setIsLoadingWeather(false);
    }).catch(() => setIsLoadingWeather(false));
  }, [waypoints, destinationWeathers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleFetchWeather();
    }, 800);
    return () => clearTimeout(timer);
  }, [waypoints.map(w => (w.stops || []).map(s => s.destination).join(',')).join('|')]);

  // Tab Switch Handler
  const handleTabChange = (newTab: 'intime' | 'router' | 'planner' | 'checklist') => {
    if (newTab === 'planner') {
      handleFetchWeather();
    }
  };

  // AI Copilot Plan Handler
  const handleApplyAiPlan = (plan: AiPlanPreview, mode: 'replace' | 'append', startDate?: string) => {
    if (startDate) {
      setTripStartDate(startDate);
      localStorage.setItem('rv_trip_start_date', startDate);
    }
    const newWaypoints: Waypoint[] = plan.waypoints.map((item: any, idx: number) => {
      let stopsList: WaypointStop[] = [];
      if (item.stops && Array.isArray(item.stops) && item.stops.length > 0) {
        stopsList = item.stops.map((s: any, sIdx: number) => ({
          id: Date.now() + idx * 100 + sIdx,
          destination: s.destination || '',
          depHour: s.depHour !== undefined ? s.depHour : (sIdx === 0 ? 8 : (11 + sIdx * 2) % 12 || 12),
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
    const nextOrigin = lastStop?.destination || userLocationName || "";

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
      {/* Top Header with User Auth & Cloud Sync */}
      <Header
        profile={profile}
        onOpenProfile={() => setIsRvProfileOpen(true)}
        user={user}
        onSignIn={() => setIsAuthModalOpen(true)}
        onSignOut={handleSignOut}
        isSyncing={isSyncing}
      />

      {/* Main Content Layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Navigation Sidebar */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} profile={profile} onTabChange={handleTabChange} />

        {/* Tab Views */}
        <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          {/* TAB 1: In-Time Finder */}
          <div className={`${activeTab === 'intime' ? 'flex' : 'hidden'} flex-1 h-full w-full`}>
            <InTimeFinderTab
              profile={profile}
              userCoords={userCoords}
              userLocationName={userLocationName}
              isGoogleLoaded={isGoogleLoaded}
              setUserCoords={setUserCoords}
              setUserLocationName={setUserLocationName}
            />
          </div>

          {/* TAB 2: Safe Router */}
          <div className={`${activeTab === 'router' ? 'flex' : 'hidden'} flex-1 h-full w-full`}>
            <SafeRouterTab
              profile={profile}
              userCoords={userCoords}
              userLocationName={userLocationName}
              isGoogleLoaded={isGoogleLoaded}
            />
          </div>

          {/* TAB 3: Trip Planner */}
          <div className={`${activeTab === 'planner' ? 'flex' : 'hidden'} flex-1 h-full w-full overflow-y-auto`}>
            <TripPlannerTab
              waypoints={waypoints}
              tripStartDate={tripStartDate}
              onUpdateTripStartDate={(dateStr) => {
                setTripStartDate(dateStr);
                localStorage.setItem('rv_trip_start_date', dateStr);
              }}
              destinationWeathers={destinationWeathers}
              profile={profile}
              isLoadingWeather={isLoadingWeather}
              onFetchWeather={handleFetchWeather}
              onOpenAiCopilot={() => setIsAiCopilotOpen(true)}
              onOpenSitePicker={handleOpenSitePicker}
              onAddWaypoint={handleAddWaypoint}
              onClearAll={handleClearAllWaypoints}
              onUpdateWaypoint={handleUpdateWaypoint}
              onRemoveWaypoint={handleRemoveWaypoint}
            />
          </div>

          {/* TAB 4: RV Checklists */}
          <div className={`${activeTab === 'checklist' ? 'flex' : 'hidden'} flex-1 h-full w-full overflow-y-auto`}>
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
              onReorderDepartureTasks={(newTasks) => setDepartureTasks(newTasks)}
              onReorderArrivalTasks={(newTasks) => setArrivalTasks(newTasks)}
            />
          </div>
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

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}
