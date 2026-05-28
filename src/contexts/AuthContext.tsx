import React, { createContext, useContext, useState, useMemo } from "react";
import { currentUser } from "@/src/data/mock";

interface AuthContextValue {
  userId: string | null;
  phone: string | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (phone: string, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userId, setUserId] = useState<string | null>(currentUser.id);
  const [phone, setPhone] = useState<string | null>(currentUser.phone);
  const [token, setToken] = useState<string | null>("mock-token");

  const login = (newPhone: string, newToken: string) => {
    setUserId(currentUser.id);
    setPhone(newPhone);
    setToken(newToken);
  };

  const logout = () => {
    setUserId(null);
    setPhone(null);
    setToken(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      userId,
      phone,
      token,
      isAuthenticated: !!token,
      login,
      logout,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, phone, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
