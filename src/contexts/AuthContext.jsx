// src/contexts/AuthContext.jsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

const AuthContext = createContext();

/**
 * Hook personalizzato per utilizzare il contesto di autenticazione
 */
export function useAuth() {
  return useContext(AuthContext);
}

/**
 * Provider per il contesto di autenticazione
 */
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Funzione per effettuare il login
   * @param {string} email
   * @param {string} password
   */
  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  /**
   * Funzione per effettuare il logout
   */
  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    // Cleanup dell'ascoltatore
    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
