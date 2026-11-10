import { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_URL = "http://localhost:5000/api";
const AuthContext = createContext(null);

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("taskflow_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem("taskflow_token");

      if (!token) {
        setCheckingSession(false);
        return;
      }

      try {
        const response = await api.get("/auth/me");
        setUser(response.data.user);
      } catch (error) {
        localStorage.removeItem("taskflow_token");
        setUser(null);
      } finally {
        setCheckingSession(false);
      }
    };

    restoreSession();
  }, []);

  const login = async (credentials) => {
    const response = await api.post("/auth/login", credentials);
    localStorage.setItem("taskflow_token", response.data.token);
    setUser(response.data.user);
    return response.data;
  };

  const register = async (details) => {
    const response = await api.post("/auth/register", details);
    localStorage.setItem("taskflow_token", response.data.token);
    setUser(response.data.user);
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem("taskflow_token");
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, checkingSession, login, register, logout }),
    [user, checkingSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
