import client from './client';

export const startShift = (data) => client.post('/shifts/start', data);
export const getActiveShift = () => client.get('/shifts/active');
export const endShift = (id, data) => client.post(`/shifts/${id}/end`, data);
export const getShiftHistory = (params) => client.get('/shifts/history', { params });
