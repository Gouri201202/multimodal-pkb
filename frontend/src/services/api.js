import axios from "axios";

const API_BASE_URL = "http://localhost:5000/api";

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log("🔑 Token added to request");
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Auth API - FIXED PATHS
export const authAPI = {
  register: (data) => api.post("/auth/register", data), // ✅ Fixed
  login: (data) => api.post("/auth/login", data),
  getMe: () => api.get("/auth/me"),
};

// Items API
export const itemsAPI = {
  getAll: (params) => api.get("/items", { params }),
  getById: (id) => api.get(`/items/${id}`),
  create: (data) => api.post("/items/text", data),
  update: (id, data) => api.put(`/items/${id}`, data),
  delete: (id) => api.delete(`/items/${id}`),
  search: (query) => api.get("/items/search/semantic", { params: { query } }),

  // ✅ ADD THESE NEW METHODS:
  uploadImage: (formData) =>
    api.post("/items/image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  uploadDocument: (formData) =>
    api.post("/items/document", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  uploadVoice: (formData) =>
    api.post("/items/voice", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

// Recommendations API
export const recommendationsAPI = {
  getHybrid: (params) => api.get("/items/recommendations/hybrid", { params }),
  getContent: (params) => api.get("/items/recommendations/content", { params }),
  getCollaborative: (params) =>
    api.get("/items/recommendations/collaborative", { params }),
  logInteraction: (data) => api.post("/items/interactions", data),
};

export default api;
