import axios from 'axios';

const API_BASE_URL = import.meta.env.PROD 
  ? 'https://stockproject-backend.onrender.com/api' 
  : 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Auto-inject JWT token header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('smartstock_token');
  if (token) {
    // Standard OAuth2 form or Bearer token header
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor to catch token expiration
api.interceptors.response.use((response) => {
  return response;
}, (error) => {
  if (error.response && error.response.status === 401) {
    // Clear storage and redirect
    localStorage.removeItem('smartstock_token');
    localStorage.removeItem('smartstock_user');
    window.location.href = '/login';
  }
  return Promise.reject(error);
});

export const authAPI = {
  login: async (username, password) => {
    // OAuth2PasswordRequestForm expects urlencoded payload
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);
    
    const response = await api.post('/auth/login', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    return response.data;
  },
  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },
  changePassword: async (old_password, new_password) => {
    const response = await api.post('/auth/change-password', { old_password, new_password });
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
  listUsers: async () => {
    const response = await api.get('/auth/users');
    return response.data;
  },
  createUser: async (username, password, role = 'worker', rights = {}) => {
    const response = await api.post('/auth/users', { 
      username, 
      password, 
      role,
      can_manage_stock: !!rights.can_manage_stock,
      can_view_expenses: !!rights.can_view_expenses,
      can_view_analytics: !!rights.can_view_analytics
    });
    return response.data;
  },
  updateUserRights: async (username, rights) => {
    const response = await api.put(`/auth/users/${username}/rights`, {
      can_manage_stock: !!rights.can_manage_stock,
      can_view_expenses: !!rights.can_view_expenses,
      can_view_analytics: !!rights.can_view_analytics,
      is_active: rights.is_active !== false
    });
    return response.data;
  },
  deleteUser: async (username) => {
    const response = await api.delete(`/auth/users/${username}`);
    return response.data;
  },
  updateProfile: async (full_name, email) => {
    const response = await api.put('/auth/profile', { full_name, email });
    return response.data;
  },
  resetUserPassword: async (username, new_password) => {
    const response = await api.put(`/auth/users/${username}/password`, { new_password });
    return response.data;
  }
};

export const productsAPI = {
  getAll: async (params) => {
    const response = await api.get('/products', { params });
    return response.data;
  },
  getOne: async (id) => {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/products', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/products/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/products/${id}`);
    return response.data;
  },
  adjustStock: async (product_id, quantity_change, reason) => {
    const response = await api.post('/products/adjust', { product_id, quantity_change, reason });
    return response.data;
  },
  getHistory: async (id) => {
    const response = await api.get(`/products/${id}/history`);
    return response.data;
  },
  importExcel: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/products/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },
  clearInventory: async () => {
    const response = await api.delete('/products/clear');
    return response.data;
  },
  exportExcelUrl: `${API_BASE_URL}/products/export/excel`
};

export const categoriesAPI = {
  getAll: async () => {
    const response = await api.get('/categories');
    return response.data;
  },
  create: async (name, description) => {
    const response = await api.post('/categories', { name, description });
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/categories/${id}`);
    return response.data;
  }
};

export const suppliersAPI = {
  getAll: async () => {
    const response = await api.get('/suppliers');
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/suppliers', data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/suppliers/${id}`);
    return response.data;
  }
};

export const billingAPI = {
  checkout: async (payload) => {
    const response = await api.post('/billing/checkout', payload);
    return response.data;
  }
};

export const transactionsAPI = {
  getAll: async (params) => {
    const response = await api.get('/transactions', { params });
    return response.data;
  },
  getOne: async (id) => {
    const response = await api.get(`/transactions/${id}`);
    return response.data;
  },
  refund: async (txId, prodId, quantity, reason) => {
    const response = await api.post(`/transactions/${txId}/refund/${prodId}`, null, {
      params: { quantity, reason }
    });
    return response.data;
  },
  getReturns: async () => {
    const response = await api.get('/transactions/returns/list');
    return response.data;
  },
  getMySummary: async () => {
    const response = await api.get('/transactions/my-summary');
    return response.data;
  }
};

export const purchasesAPI = {
  getAll: async () => {
    const response = await api.get('/purchases');
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/purchases', data);
    return response.data;
  },
  updateStatus: async (id, status) => {
    const response = await api.put(`/purchases/${id}/status`, null, {
      params: { status_str: status }
    });
    return response.data;
  }
};

export const expensesAPI = {
  getAll: async (params) => {
    const response = await api.get('/expenses', { params });
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/expenses', data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/expenses/${id}`);
    return response.data;
  }
};

export const settingsAPI = {
  get: async () => {
    const response = await api.get('/settings');
    return response.data;
  },
  update: async (data) => {
    const response = await api.put('/settings', data);
    return response.data;
  }
};

export const backupAPI = {
  getAll: async () => {
    const response = await api.get('/backup/list');
    return response.data;
  },
  create: async () => {
    const response = await api.post('/backup/create');
    return response.data;
  },
  restore: async (id) => {
    const response = await api.post(`/backup/restore/${id}`);
    return response.data;
  },
  downloadUrl: (id) => {
    const token = localStorage.getItem('smartstock_token');
    return `${API_BASE_URL}/backup/download/${id}?token=${encodeURIComponent(token || '')}`;
  }
};

export const aiAPI = {
  getRecommendations: async () => {
    const response = await api.get('/ai/recommendations');
    return response.data;
  },
  trigger: async () => {
    const response = await api.post('/ai/trigger');
    return response.data;
  },
  getForecast: async (prodId) => {
    const response = await api.get(`/ai/forecast/${prodId}`);
    return response.data;
  }
};

export const notificationsAPI = {
  getAll: async (unreadOnly = false) => {
    const response = await api.get('/notifications', { params: { unread_only: unreadOnly } });
    return response.data;
  },
  markRead: async (id) => {
    const response = await api.put(`/notifications/${id}/read`);
    return response.data;
  },
  markAllRead: async () => {
    const response = await api.put('/notifications/read-all');
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/notifications/${id}`);
    return response.data;
  }
};

export const analyticsAPI = {
  getKPIs: async (period, start_date = null, end_date = null) => {
    const response = await api.get('/analytics/dashboard/kpis', { 
      params: { 
        period,
        start_date: start_date || undefined,
        end_date: end_date || undefined
      } 
    });
    return response.data;
  },
  getRecentActivity: async () => {
    const response = await api.get('/analytics/dashboard/recent-activity');
    return response.data;
  },
  getTrends: async (period) => {
    const response = await api.get('/analytics/sales/trends', { params: { period } });
    return response.data;
  },
  getCategoryShare: async () => {
    const response = await api.get('/analytics/category-share');
    return response.data;
  },
  downloadReport: async (period) => {
    const response = await api.get('/analytics/report/pdf', {
      params: { period },
      responseType: 'blob'
    });
    return response.data;
  },
  getPaymentMethods: async () => {
    const response = await api.get('/analytics/payment-methods');
    return response.data;
  },
  getHourlyHeatmap: async () => {
    const response = await api.get('/analytics/hourly-heatmap');
    return response.data;
  }
};

export default api;
