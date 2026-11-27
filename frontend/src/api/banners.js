import client from './client';

// Kelola banner self-order — hanya Owner & tim Promo
export const getBanners = () => client.get('/banners');
export const createBanner = (data) => client.post('/banners', data);
export const updateBanner = (id, data) => client.put(`/banners/${id}`, data);
export const deleteBanner = (id) => client.delete(`/banners/${id}`);
export const uploadBannerImage = (id, file) => {
  const form = new FormData();
  form.append('file', file);
  return client.post(`/banners/${id}/image`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const deleteBannerImage = (id) => client.delete(`/banners/${id}/image`);
