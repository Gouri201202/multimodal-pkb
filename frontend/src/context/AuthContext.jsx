import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from "react";
import { authAPI } from "../services/api";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem("token"));

  // Use useCallback to prevent infinite loops
  const fetchUser = useCallback(async () => {
    try {
      const response = await authAPI.getMe();
      setUser(response.data.user);
    } catch (error) {
      console.error("Failed to fetch user:", error);
      localStorage.removeItem("token");
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array since it doesn't depend on any state

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token, fetchUser]); // Now includes fetchUser

  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    const { token, user } = response.data;
    localStorage.setItem("token", token);
    setToken(token);
    setUser(user);
    return response.data;
  };

  const register = async (name, email, password) => {
    const response = await authAPI.register({ name, email, password });
    const { token, user } = response.data;
    localStorage.setItem("token", token);
    setToken(token);
    setUser(user);
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
