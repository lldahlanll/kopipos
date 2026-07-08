import client from './client';

export const getProducts = (params = {}) =>
  client.get('/products', { params });

export const getProduct = (id) => client.get(`/products/${id}`);

export const createProduct = (data) => client.post('/products', data);

export const updateProduct = (id, data) => client.put(`/products/${id}`, data);

export const deleteProduct = (id) => client.delete(`/products/${id}`);

export const uploadProductImage = (id, file) => {
  const form = new FormData();
  form.append('file', file);
  return client.post(`/products/${id}/image`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const createVariant = (productId, data) =>
  client.post(`/products/${productId}/variants`, data);

export const updateVariant = (variantId, data) =>
  client.put(`/products/variants/${variantId}`, data);

export const deleteVariant = (variantId) =>
  client.delete(`/products/variants/${variantId}`);
