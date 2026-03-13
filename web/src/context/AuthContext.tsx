import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User, AuthData } from '../types';
import { apiUrl } from '../utils/api';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    error: string | null;
    isAuthenticated: boolean;
    isProfileComplete: boolean;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    logout: () => Promise<void>;
    refetch: () => Promise<void>;
    setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    // Start with loading true to block premature rendering
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [theme, setTheme] = useState<'light' | 'dark'>(
        (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
    );

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const fetchUser = async () => {
        // Only set loading if we don't have a user (initial load)
        // or if we want to show a spinner refresh. 
        // For background refreshes, we might not want to set isLoading to true.
        if (!user) setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(apiUrl('/api/auth/me'), {
                credentials: 'include'
            });

            if (response.ok) {
                const data: AuthData = await response.json();
                console.log('[Auth] User fetched successfully:', data.user.email);
                setUser(data.user);
            } else if (response.status === 401) {
                console.log('[Auth] Not authenticated (401)');
                setUser(null);
            } else {
                const errorData = await response.json();
                console.error('[Auth] Error fetching user:', errorData);
                setError(errorData.error || 'Failed to fetch user');
                // Don't clear user on transient errors? 
                // Better to be safe and clear if we're not sure.
                setUser(null);
            }
        } catch (err) {
            console.error('[Auth] Network/Parse error:', err);
            setError(err instanceof Error ? err.message : 'Network error');
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUser();
    }, []); // Only fetch on mount

    useEffect(() => {
        if (!user) return;

        const interval = setInterval(() => {
            fetch(apiUrl('/api/auth/me'), { credentials: 'include' })
                .then(res => {
                    if (res.status === 401) {
                        console.log('[Auth] Session expired');
                        setUser(null);
                    }
                })
                .catch(() => { });
        }, 60000 * 5); // every 5 mins

        return () => clearInterval(interval);
    }, [user]); // Reset interval if user status changes

    const logout = async () => {
        try {
            await fetch(apiUrl('/api/auth/logout'), {
                method: 'POST',
                credentials: 'include'
            });
            setUser(null);
        } catch (err) {
            console.error('[Auth] Logout failed:', err);
            // Even if network fails, clear local state
            setUser(null);
        }
    };

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    const value: AuthContextType = {
        user,
        isLoading,
        error,
        isAuthenticated: !!user,
        isProfileComplete: user?.isProfileComplete ?? false,
        theme,
        toggleTheme,
        logout,
        refetch: fetchUser,
        setUser
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuthContext must be used within an AuthProvider');
    }
    return context;
};
