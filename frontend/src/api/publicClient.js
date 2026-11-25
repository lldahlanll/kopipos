import axios from 'axios';

// VITE_API_BASE dibaca dari frontend/.env (production) atau frontend/.env.local (lokal).
// Jika tidak diset, fallback ke '/api' yang bekerja via proxy Vite (dev) atau Nginx (prod).
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const publicClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

publicClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('member_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default publicClient;
