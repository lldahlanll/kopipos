import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://api.kopipos.ephinu.my.id/api';

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
