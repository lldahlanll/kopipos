import React, { createContext, useContext, useState, useEffect } from 'react';
import client from '../api/client';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    // Jangan fetch jika belum login (tidak ada token)
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await client.get('/settings');
      const data = res.data;
      setSettings(data);
      
      // Inject CSS variables
      if (data.theme_color) {
        document.documentElement.style.setProperty('--color-primary', data.theme_color);
        
        // Also compute a glow color based on the primary color (simple hex to rgba)
        const hexToRgb = (hex) => {
          let c;
          if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
              c= hex.substring(1).split('');
              if(c.length== 3){
                  c= [c[0], c[0], c[1], c[1], c[2], c[2]];
              }
              c= '0x'+c.join('');
              return [(c>>16)&255, (c>>8)&255, c&255].join(',');
          }
          return '200, 162, 122'; // fallback default primary rgb
        }
        document.documentElement.style.setProperty('--color-primary-glow', `rgba(${hexToRgb(data.theme_color)}, 0.4)`);
      }
      
    } catch (error) {
      // Abaikan 401 - user memang belum login
      if (error?.response?.status !== 401) {
        console.error("Gagal memuat pengaturan:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const refreshSettings = () => {
    return fetchSettings();
  };

  return (
    <SettingsContext.Provider value={{
      settings,
      loading,
      storeName: settings?.store_name || "KopiPOS",
      storeLogo: settings?.store_logo || null,
      themeColor: settings?.theme_color || "#c8a27a",
      refreshSettings
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
