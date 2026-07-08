import client from './client';

export const getCategories = (activeOnly = false) =>
  client.get('/categories', { params: { active_only: activeOnly } });

export const createCategory = (data) => client.post('/categories', data);

export const updateCategory = (id, data) => client.put(`/categories/${id}`, data);

export const deleteCategory = (id) => client.delete(`/categories/${id}`);
