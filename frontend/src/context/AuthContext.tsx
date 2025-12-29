import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithProvider,
  signOut as firebaseSignOut,
  getCurrentUserToken,
  onAuthChange,
  FirebaseUser,
  AuthProvider as FirebaseAuthProvider,
} from '../services/firebase';
import { getUserProfile } from '../services/api';
import toast from 'react-hot-toast';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  plan: 'free' | 'pro' | 'enterprise';
  provider: string;
}

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (provider: FirebaseAuthProvider) => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile from backend
  const fetchUserProfile = async (firebaseUser: FirebaseUser) => {
    try {
      const token = await firebaseUser.getIdToken();
      const profile = await getUserProfile(token);
      setUserProfile(profile);
    } catch (error) {
      console.error('[Auth] Failed to fetch user profile:', error);
      toast.error('Failed to load user profile');
    }
  };

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        await fetchUserProfile(firebaseUser);
      } else {
        setUserProfile(null);
      }

      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sign in with provider
  const signIn = async (provider: FirebaseAuthProvider) => {
    try {
      setIsLoading(true);
      await signInWithProvider(provider);
      toast.success('Successfully signed in!');
    } catch (error: any) {
      console.error('[Auth] Sign in error:', error);

      // Handle specific Firebase errors
      if (error.code === 'auth/popup-closed-by-user') {
        toast.error('Sign-in cancelled');
      } else if (error.code === 'auth/popup-blocked') {
        toast.error('Popup blocked. Please allow popups for this site.');
      } else {
        toast.error('Failed to sign in. Please try again.');
      }

      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      setIsLoading(true);
      await firebaseSignOut();
      setUser(null);
      setUserProfile(null);
      toast.success('Signed out successfully');
    } catch (error) {
      console.error('[Auth] Sign out error:', error);
      toast.error('Failed to sign out');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Get current user token
  const getToken = async (): Promise<string | null> => {
    return await getCurrentUserToken();
  };

  // Refresh user profile
  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user);
    }
  };

  const value: AuthContextType = {
    user,
    userProfile,
    isLoading,
    isAuthenticated: !!user,
    signIn,
    signOut,
    getToken,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
