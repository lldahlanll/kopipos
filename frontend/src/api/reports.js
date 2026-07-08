import client from './client';

export const getDailySummary = (date) =>
  client.get('/reports/daily', { params: { date } });

export const getRangeSummary = (date_from, date_to) =>
  client.get('/reports/summary', { params: { date_from, date_to } });

export const getPaymentSummary = (date_from, date_to) =>
  client.get('/reports/payment-summary', { params: { date_from, date_to } });

export const getBestSellers = (date_from, date_to) =>
  client.get('/reports/best-sellers', { params: { date_from, date_to } });

export const getDailyBreakdown = (date_from, date_to) =>
  client.get('/reports/daily-breakdown', { params: { date_from, date_to } });
