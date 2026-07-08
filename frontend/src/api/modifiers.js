import client from './client';

export const getModifiers = (activeOnly = false) =>
  client.get('/modifiers', { params: { active_only: activeOnly } });

export const createModifier = (data) => client.post('/modifiers', data);

export const updateModifier = (id, data) => client.put(`/modifiers/${id}`, data);

export const deleteModifier = (id) => client.delete(`/modifiers/${id}`);
