import axios from 'axios';

const API_BASE_URL = '/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Auth API
export const authAPI = {
  register: (username, email, password) =>
    api.post('/auth/register', { username, email, password }),

  login: (username, password) =>
    api.post('/auth/login', { username, password }),

  getMe: () =>
    api.get('/auth/me'),
};

// Email API
export const emailAPI = {
  getEmails: (folder = 'inbox') =>
    api.get(`/emails?folder=${folder}`),

  getEmail: (emailId) =>
    api.get(`/emails/${emailId}`),

  createEmail: (data) =>
    api.post('/emails', data),

  updateEmail: (emailId, data) =>
    api.put(`/emails/${emailId}`, data),

  deleteEmail: (emailId) =>
    api.delete(`/emails/${emailId}`),

  markAsRead: (emailId, isRead) =>
    api.put(`/emails/${emailId}/read`, { is_read: isRead }),

  sendDraft: (emailId) =>
    api.put(`/emails/${emailId}/send`),

  searchUsers: (query) =>
    api.get(`/users/search?q=${query}`),
};

// Attachment API
export const attachmentAPI = {
  uploadFiles: async (files, onProgress) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const config = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    };

    if (onProgress) {
      config.onUploadProgress = (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percentCompleted);
      };
    }

    return api.post('/attachments/upload', formData, config);
  },

  getDownloadUrl: (attachmentId) =>
    `${API_BASE_URL}/attachments/${attachmentId}/download`,

  deleteAttachment: (attachmentId) =>
    api.delete(`/attachments/${attachmentId}`),
};

export default api;
