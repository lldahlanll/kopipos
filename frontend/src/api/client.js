import axios from 'axios';

// Gunakan path relatif (/api) agar Vite proxy aktif saat dev lokal.
// Di produksi (build), gunakan URL absolut dari env.
const API_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_BASE || '/api')
  : '/api';

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    if (err.response?.data?.detail) {
      const detail = err.response.data.detail;
      if (Array.isArray(detail)) {
        err.response.data.detail = detail.map(d => d.msg || JSON.stringify(d)).join(', ');
      } else if (typeof detail === 'object') {
        err.response.data.detail = JSON.stringify(detail);
      }
    }
    return Promise.reject(err);
  }
);

export default client;
