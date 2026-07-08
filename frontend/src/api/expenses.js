import api from './client';

export const createExpense = (shiftId, expenseData) => {
  return api.post(`/shifts/${shiftId}/expenses`, expenseData);
};
