import client from './client';

// Kelola promo — hanya Owner & tim Promo
export const getPromos = () => client.get('/promos');
export const createPromo = (data) => client.post('/promos', data);
export const updatePromo = (id, data) => client.put(`/promos/${id}`, data);
export const deletePromo = (id) => client.delete(`/promos/${id}`);

// Promo yang sedang berlaku — untuk dipilih kasir di POS
export const getAvailablePromos = () => client.get('/promos/available');
