import client from './client';

export const getSettings = () => client.get('/settings');
export const updateSettings = (data) => client.put('/settings', { settings: data });

export const uploadLogo = (file) => {
  const form = new FormData();
  form.append('file', file);
  return client.post('/settings/logo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
