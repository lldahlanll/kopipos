/**
 * useOnlineStatus.js
 * Hook untuk mendeteksi status koneksi internet secara real-time.
 * Menggabungkan event browser (online/offline) dengan ping periodik ke backend.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';
// Saat dev lokal, gunakan path relatif (/api/health) agar Vite proxy aktif.
// Saat production build, gunakan URL absolut dari env.
const HEALTH_URL = (!import.meta.env.PROD && !API_URL)
  ? '/api/health'
  : API_URL
    ? `${API_URL}/api/health`
    : '/api/health';
const PING_INTERVAL_MS = 15_000; // ping setiap 15 detik
const PING_TIMEOUT_MS = 5_000;  // timeout 5 detik

/**
 * Ping ke backend health endpoint.
 * @returns {Promise<boolean>} true jika server bisa dijangkau
 */
async function pingServer() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    const res = await fetch(HEALTH_URL, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Custom hook: status koneksi real-time.
 *
 * @returns {{
 *   isOnline: boolean,        // true jika browser + server bisa dijangkau
 *   isBrowserOnline: boolean, // true jika browser menganggap ada jaringan
 *   checkNow: () => void,     // force ping sekarang
 * }}
 */
export function useOnlineStatus() {
  const [isBrowserOnline, setIsBrowserOnline] = useState(navigator.onLine);
  const [isServerReachable, setIsServerReachable] = useState(true);
  const intervalRef = useRef(null);

  const checkServer = useCallback(async () => {
    if (!navigator.onLine) {
      setIsServerReachable(false);
      return;
    }
    const ok = await pingServer();
    setIsServerReachable(ok);
  }, []);

  useEffect(() => {
    // Event browser
    const handleOnline = () => {
      setIsBrowserOnline(true);
      checkServer(); // langsung ping saat browser kembali online
    };
    const handleOffline = () => {
      setIsBrowserOnline(false);
      setIsServerReachable(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Ping periodik
    checkServer(); // ping pertama saat mount
    intervalRef.current = setInterval(checkServer, PING_INTERVAL_MS);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalRef.current);
    };
  }, [checkServer]);

  const isOnline = isBrowserOnline && isServerReachable;

  return {
    isOnline,
    isBrowserOnline,
    checkNow: checkServer,
  };
}
