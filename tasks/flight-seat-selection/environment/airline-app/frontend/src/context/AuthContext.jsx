import React, { createContext, useState, useContext, useEffect } from 'react';
import api, { authAPI } from '../services/api';

const AuthContext = createContext(null);

// PR-6 / B6.2 L4 — real auto-login against mock-airline JWT middleware.
//
// PR-3 swapped the Flask backend (which let the frontend fake "auto-login"
// because routes hardcoded DEFAULT_USER_ID = 1) for the Bun mock-airline
// binary, which requires a real JWT cookie or Authorization Bearer header
// on every /api/* route except /api/auth/{login,register} and a few public
// listing endpoints. The previous version of this context lied — it set
// `isAuthenticated: true` on mount but never obtained a token, so any
// /api/profile or /api/bookings call returned 401 and the agent saw an
// empty page (then often gave up and registered a throwaway account).
//
// The seed always inserts Peter at the same identity:
//   email    peter.griffin@work.mosi.inc
//   password password123
//   user_id  1
// (see mock-platform/mocks/airline/src/seed.ts). The frontend now calls
// /api/auth/login on mount, stores the access_token in localStorage so
// later page loads can re-use it without re-auth, and falls back to the
// stored token on hot-reload. /api/auth/login also returns Set-Cookie
// `token=...` which the browser replays for subsequent same-origin
// requests, so both auth channels (cookie + Bearer) are now armed.

const TOKEN_KEY = 'gkd_airline_token';
const PETER_EMAIL = 'peter.griffin@work.mosi.inc';
const PETER_PASSWORD = 'password123';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bootstrap();
  }, []);

  const bootstrap = async () => {
    // Reuse token from localStorage if still valid, otherwise log in fresh.
    let token = null;
    try {
      token = localStorage.getItem(TOKEN_KEY);
    } catch (_) {
      token = null;
    }

    if (token) {
      try {
        const response = await authAPI.getProfile();
        setUser(response.data.data);
        setLoading(false);
        return;
      } catch (_) {
        // Token expired or invalid — fall through to fresh login.
        try { localStorage.removeItem(TOKEN_KEY); } catch (_) {}
      }
    }

    // Fresh auto-login.
    try {
      const loginResp = await api.post('/auth/login', {
        email: PETER_EMAIL,
        password: PETER_PASSWORD,
      });
      const accessToken = loginResp?.data?.data?.access_token;
      const u = loginResp?.data?.data?.user;
      if (accessToken) {
        try { localStorage.setItem(TOKEN_KEY, accessToken); } catch (_) {}
      }
      if (u) setUser(u);
    } catch (error) {
      console.error('Auto-login as Peter Griffin failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (userData) => {
    const response = await authAPI.updateProfile(userData);
    setUser(response.data.data);
    return response.data.data;
  };

  const value = {
    user,
    loading,
    updateProfile,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
