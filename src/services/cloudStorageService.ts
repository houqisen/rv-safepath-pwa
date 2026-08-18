import {
  doc,
  setDoc,
  getDoc,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import { RvProfile } from '../types/rv';
import { Waypoint } from '../types/itinerary';
import { ChecklistTask } from '../types/checklist';

// ==========================================
// RV PROFILE CLOUD METHODS
// ==========================================

export async function saveUserProfileToCloud(userId: string, profile: RvProfile): Promise<void> {
  if (!userId) return;
  const profileRef = doc(db, 'users', userId, 'profile', 'default');
  await setDoc(profileRef, {
    ...profile,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

export async function loadUserProfileFromCloud(userId: string): Promise<RvProfile | null> {
  if (!userId) return null;
  const profileRef = doc(db, 'users', userId, 'profile', 'default');
  const snap = await getDoc(profileRef);
  if (snap.exists()) {
    const data = snap.data();
    const { updatedAt, ...cleanProfile } = data;
    return cleanProfile as RvProfile;
  }
  return null;
}

// ==========================================
// ITINERARY WAYPOINTS CLOUD METHODS
// ==========================================

export async function saveUserWaypointsToCloud(userId: string, waypoints: Waypoint[]): Promise<void> {
  if (!userId) return;
  const itineraryRef = doc(db, 'users', userId, 'itinerary', 'active');
  await setDoc(itineraryRef, {
    waypoints,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

export async function loadUserWaypointsFromCloud(userId: string): Promise<Waypoint[] | null> {
  if (!userId) return null;
  const itineraryRef = doc(db, 'users', userId, 'itinerary', 'active');
  const snap = await getDoc(itineraryRef);
  if (snap.exists()) {
    const data = snap.data();
    return (data.waypoints || []) as Waypoint[];
  }
  return null;
}

// ==========================================
// CHECKLISTS CLOUD METHODS
// ==========================================

export async function saveUserChecklistsToCloud(
  userId: string,
  departureTasks: ChecklistTask[],
  arrivalTasks: ChecklistTask[]
): Promise<void> {
  if (!userId) return;
  const checklistsRef = doc(db, 'users', userId, 'checklists', 'active');
  await setDoc(checklistsRef, {
    departureTasks,
    arrivalTasks,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

export async function loadUserChecklistsFromCloud(
  userId: string
): Promise<{ departureTasks: ChecklistTask[]; arrivalTasks: ChecklistTask[] } | null> {
  if (!userId) return null;
  const checklistsRef = doc(db, 'users', userId, 'checklists', 'active');
  const snap = await getDoc(checklistsRef);
  if (snap.exists()) {
    const data = snap.data();
    return {
      departureTasks: data.departureTasks || [],
      arrivalTasks: data.arrivalTasks || []
    };
  }
  return null;
}

// ==========================================
// REAL-TIME SYNC SUBSCRIBER ACROSS DEVICES
// ==========================================

export function subscribeToUserCloudData(
  userId: string,
  callbacks: {
    onProfileUpdate?: (profile: RvProfile) => void;
    onWaypointsUpdate?: (waypoints: Waypoint[]) => void;
    onChecklistsUpdate?: (tasks: { departureTasks: ChecklistTask[]; arrivalTasks: ChecklistTask[] }) => void;
  }
): () => void {
  if (!userId) return () => {};

  const unsubs: (() => void)[] = [];

  // 1. Profile Live Listener
  if (callbacks.onProfileUpdate) {
    const profileRef = doc(db, 'users', userId, 'profile', 'default');
    const unsubProfile = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        const { updatedAt, ...cleanProfile } = snap.data();
        callbacks.onProfileUpdate!(cleanProfile as RvProfile);
      }
    });
    unsubs.push(unsubProfile);
  }

  // 2. Itinerary Live Listener
  if (callbacks.onWaypointsUpdate) {
    const itineraryRef = doc(db, 'users', userId, 'itinerary', 'active');
    const unsubItinerary = onSnapshot(itineraryRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.waypoints) {
          callbacks.onWaypointsUpdate!(data.waypoints as Waypoint[]);
        }
      }
    });
    unsubs.push(unsubItinerary);
  }

  // 3. Checklists Live Listener
  if (callbacks.onChecklistsUpdate) {
    const checklistsRef = doc(db, 'users', userId, 'checklists', 'active');
    const unsubChecklists = onSnapshot(checklistsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        callbacks.onChecklistsUpdate!({
          departureTasks: data.departureTasks || [],
          arrivalTasks: data.arrivalTasks || []
        });
      }
    });
    unsubs.push(unsubChecklists);
  }

  // Return master cleanup function
  return () => {
    unsubs.forEach(unsub => unsub());
  };
}
