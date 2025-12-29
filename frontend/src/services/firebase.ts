import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  GithubAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Auth provider types
export type AuthProvider = 'google' | 'microsoft' | 'apple' | 'github';

/**
 * Sign in with a social provider (Google, Microsoft, Apple, GitHub).
 *
 * @param provider - The authentication provider to use
 * @returns Promise resolving to the Firebase user
 */
export async function signInWithProvider(provider: AuthProvider): Promise<FirebaseUser> {
  let authProvider;

  switch (provider) {
    case 'google':
      authProvider = new GoogleAuthProvider();
      break;
    case 'microsoft':
      authProvider = new OAuthProvider('microsoft.com');
      break;
    case 'apple':
      authProvider = new OAuthProvider('apple.com');
      break;
    case 'github':
      authProvider = new GithubAuthProvider();
      break;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  const result = await signInWithPopup(auth, authProvider);
  return result.user;
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Get the current user's Firebase ID token.
 * This token is used to authenticate with the backend API.
 *
 * @returns Promise resolving to the ID token, or null if not authenticated
 */
export async function getCurrentUserToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) {
    return null;
  }

  try {
    // Force refresh to ensure token is fresh
    const token = await user.getIdToken(false);
    return token;
  } catch (error) {
    console.error('[Firebase] Failed to get ID token:', error);
    return null;
  }
}

/**
 * Listen for authentication state changes.
 *
 * @param callback - Function to call when auth state changes
 * @returns Unsubscribe function
 */
export function onAuthChange(callback: (user: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Get the current Firebase user.
 *
 * @returns The current user or null if not authenticated
 */
export function getCurrentUser(): FirebaseUser | null {
  return auth.currentUser;
}

export type { FirebaseUser };
