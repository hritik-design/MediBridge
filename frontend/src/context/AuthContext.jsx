import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => api.get('/auth/me').then(r => { setUser(r.data); return r.data; });

  useEffect(() => {
    if (!localStorage.getItem('mb_token')) { setLoading(false); return; }
    refresh().catch(() => localStorage.removeItem('mb_token')).finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('mb_token', data.token);
    return refresh();
  };
  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {  }
    localStorage.removeItem('mb_token'); setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>{children}</AuthContext.Provider>;
}
