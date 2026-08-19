import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { auth } from './firebase';

export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

/**
 * Sign in using Google OAuth Popup
 */
export async function signInWithGoogle(): Promise<AuthUser> {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  return {
    uid: user.uid,
    displayName: user.displayName || user.email?.split('@')[0] || 'RV Traveler',
    email: user.email,
    photoURL: user.photoURL
  };
}

/**
 * Sign in using Email and Password
 */
export async function signInWithEmail(email: string, pass: string): Promise<AuthUser> {
  const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
  const user = result.user;
  return {
    uid: user.uid,
    displayName: user.displayName || user.email?.split('@')[0] || 'RV Traveler',
    email: user.email,
    photoURL: user.photoURL
  };
}

/**
 * Register a new account with Email and Password
 */
export async function registerWithEmail(email: string, pass: string, displayName?: string): Promise<AuthUser> {
  const result = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  const user = result.user;
  if (displayName && displayName.trim()) {
    await updateProfile(user, { displayName: displayName.trim() });
  }
  return {
    uid: user.uid,
    displayName: displayName?.trim() || user.email?.split('@')[0] || 'RV Traveler',
    email: user.email,
    photoURL: user.photoURL
  };
}

/**
 * Send Password Reset Email
 */
export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Sign out the current user
 */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Listen to real-time auth state changes
 */
export function onAuthChange(callback: (user: AuthUser | null) => void): () => void {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      callback({
        uid: user.uid,
        displayName: user.displayName || user.email?.split('@')[0] || 'RV Traveler',
        email: user.email,
        photoURL: user.photoURL
      });
    } else {
      callback(null);
    }
  });
}
