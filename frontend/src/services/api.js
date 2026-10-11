import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const api = axios.create({ baseURL: BASE_URL, timeout: 15000, headers: { 'Content-Type': 'application/json' } });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dm_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, (error) => Promise.reject(error));

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('dm_token');
      localStorage.removeItem('dm_user');
      window.location.href = '/login';
    }
    return Promise.reject(error.response?.data || { message: 'Error de conexion.' });
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  verifyEmail: (token) => api.get(`/auth/verify-email?token=${token}`),
  getMe: () => api.get('/auth/me')
};

export const usersAPI = {
  getProfile: (id) => api.get(`/users/${id}/profile`)
};

export const productsAPI = {
  list: (params) => api.get('/products', { params }),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  myProducts: () => api.get('/my/products')
};

export const transactionsAPI = {
  initiate: (data) => api.post('/transactions', data),
  getById: (id) => api.get(`/transactions/${id}`),
  getPurchases: (params) => api.get('/transactions/purchases', { params }),
  getSales: (params) => api.get('/transactions/sales', { params }),
  confirmPayment: (id, gatewayRef) => api.post(`/transactions/${id}/confirm-payment`, { gatewayRef }),
  getReleaseCodeStatus: (id) => api.get(`/transactions/${id}/release-code-status`),
  validateCode: (transactionId, code) => api.post('/transactions/validate-code', { transaction_id: transactionId, code }),
  proposeMeeting: (transactionId, data) => api.post(`/transactions/${transactionId}/meetings`, data),
  respondToMeeting: (meetingId, action) => api.put(`/meetings/${meetingId}/respond`, { action }),
  openDispute: (transactionId, data) => api.post(`/transactions/${transactionId}/dispute`, data)
};

export const ratingsAPI = {
  create: (transactionId, data) => api.post(`/ratings/${transactionId}`, data)
};

export const adminAPI = {
  getDisputes: (params) => api.get('/admin/disputes', { params }),
  resolveDispute: (disputeId, data) => api.put(`/admin/disputes/${disputeId}/resolve`, data),
  getStats: () => api.get('/admin/stats'),
  getUsers: (params) => api.get('/admin/users', { params }),
  getUserDetail: (id) => api.get(`/admin/users/${id}`),
  banUser: (id, action) => api.put(`/admin/users/${id}/ban`, { action }),
  removeProduct: (id) => api.delete(`/admin/products/${id}`),
  verifyUserEmail: (id) => api.put(`/admin/users/${id}/verify-email`)
};

export default api;
