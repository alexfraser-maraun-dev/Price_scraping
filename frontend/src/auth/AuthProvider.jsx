import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Setup axios default to always send cookies
    axios.defaults.withCredentials = true;

    const checkAuth = async () => {
        try {
            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const response = await axios.get(`${baseUrl}/auth/whoami`);
            if (response.data.authenticated) {
                setUser(response.data.user);
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error("Auth check failed", error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkAuth();
    }, []);

    // Global 401 handling: if a session expires mid-use, any protected call that
    // comes back 401 drops the user, and Layout re-renders to the Login screen.
    useEffect(() => {
        const interceptorId = axios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 401) {
                    setUser(null);
                }
                return Promise.reject(error);
            }
        );
        return () => axios.interceptors.response.eject(interceptorId);
    }, []);

    const login = () => {
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const returnTo = window.location.origin + '/';
        window.location.href = `${baseUrl}/auth/login?return_to=${encodeURIComponent(returnTo)}`;
    };

    const logout = async () => {
        try {
            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            await axios.post(`${baseUrl}/auth/logout`);
            setUser(null);
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
