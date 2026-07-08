import client from './client';

export const createOrder = (data, idempotencyKey) => client.post('/orders', data, {
  headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {},
});
export const getActiveOrders = () => client.get('/orders/kitchen/active');
export const updateOrderStatus = (id, status) => client.patch(`/orders/${id}/status?status=${status}`);

export const getOrders = (params = {}) =>
  client.get('/orders', { params });

export const getOrder = (id) => client.get(`/orders/${id}`);

export const voidOrder = (id, data) => client.post(`/orders/${id}/void`, data);
export const refundOrder = (id, data) => client.post(`/orders/${id}/refund`, data);
export const bulkReviewOrders = (data) => client.post('/orders/bulk-review', data);

