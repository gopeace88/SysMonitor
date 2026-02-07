"use client";

import { useState, useCallback, useEffect } from "react";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8400";

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export function useAuth(): AuthState {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsAuthenticated(!!token);
    setIsLoading(false);
  }, []);

  const login = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      try {
        const res = await fetch(`${BASE_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        if (!res.ok) {
          return false;
        }

        const data = await res.json();
        const token = data.token || data.access_token;

        if (token) {
          localStorage.setItem("token", token);
          setIsAuthenticated(true);
          return true;
        }

        return false;
      } catch {
        return false;
      }
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
    window.location.href = "/login";
  }, []);

  return { isAuthenticated, isLoading, login, logout };
}
