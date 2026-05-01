import axios from 'axios';

// Use relative URL to work with Vite proxy
const API_BASE_URL = '/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth API (no trailing slashes - backend routes don't have them)
export const authAPI = {
  getProfile: () => api.get('/profile'),
  updateProfile: (data) => api.put('/profile', data),
};

// Flights API
export const flightsAPI = {
  getAll: (params) => api.get('/flights', { params }),
  search: (data) => api.post('/flights/search', data),
  getById: (id) => api.get(`/flights/${id}`),
  getSeats: (id, params) => api.get(`/flights/${id}/seats`, { params }),
};

// Bookings API
export const bookingsAPI = {
  getAll: (params) => api.get('/bookings', { params }),
  getByReference: (reference) => api.get(`/bookings/${reference}`),
  create: (data) => api.post('/bookings', data),
  assignSeats: (reference, data) => api.post(`/bookings/${reference}/seats`, data),
  cancel: (reference) => api.post(`/bookings/${reference}/cancel`),
};

// Check-in API
export const checkinAPI = {
  checkin: (reference) => api.post(`/checkin/${reference}`),
  getBoardingPass: (reference) => api.get(`/checkin/${reference}/boarding-pass`),
  getEligible: () => api.get('/checkin/eligible'),
  getSeatChart: (reference) => api.get(`/checkin/${reference}/seats`),
};

// Claims API
export const claimsAPI = {
  getAll: (params) => api.get('/claims', { params }),
  getById: (id) => api.get(`/claims/${id}`),
  create: (data) => api.post('/claims', data),
  update: (id, data) => api.put(`/claims/${id}`, data),
  calculateRefund: (reference, data) => api.post(`/claims/calculate-refund/${reference}`, data),
};

// Mock Services API
export const mockAPI = {
  // Email
  getEmails: (params) => api.get('/emails', { params }),
  getEmailById: (id) => api.get(`/emails/${id}`),

  // Calendar
  getCalendarEvents: (params) => api.get('/calendar/events', { params }),

  // Payment
  processPayment: (data) => api.post('/payment/process', data),

  // Chat
  getChatSessions: () => api.get('/chat/sessions'),
  createChatSession: () => api.post('/chat/sessions'),
  sendMessage: (sessionId, message) => api.post(`/chat/sessions/${sessionId}/messages`, { message }),
  closeChatSession: (sessionId) => api.post(`/chat/sessions/${sessionId}/close`),
};

// Announcements API
export const announcementsAPI = {
  getList: (params) => api.get('/announcements', { params }),
  getDetails: (id) => api.get(`/announcements/${id}`),
};

// FAQ API
export const faqAPI = {
  getList: (params) => api.get('/faq', { params }),
  getDetails: (id) => api.get(`/faq/${id}`),
};

// Baggage API
export const baggageAPI = {
  getList: (params) => api.get('/baggage', { params }),
  submit: (data) => api.post('/baggage', data),
  getDetails: (id) => api.get(`/baggage/${id}`),
};

// Info API
export const infoAPI = {
  getRestaurant: () => api.get('/info/restaurant'),
  getAirport: () => api.get('/info/airport'),
};

export default api;
