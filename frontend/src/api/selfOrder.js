import publicClient from './publicClient';

export const getStoreInfo = () => publicClient.get('/public/store-info');

export const getPublicMenu = () => publicClient.get('/public/menu');

export const createSelfOrder = (data, idempotencyKey) => publicClient.post('/public/orders', data, {
  headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {},
});

export const getOrderStatus = (id) => publicClient.get(`/public/orders/${id}/status`);


export const registerMember = (data) => publicClient.post('/member/register', data);
export const loginMember = (data) => publicClient.post('/member/login', data);
export const getMemberProfile = () => publicClient.get('/member/profile');
export const getMemberOrders = () => publicClient.get('/public/orders');
