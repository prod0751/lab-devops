import axios from 'axios';
import { Product, StockMovement } from '../types/product';
import { DashboardOverview } from '../types/dashboard';
import { User } from '../types/user';
import { API_BASE_URL } from './config';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dsk_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface Paged<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
  };
}

export const AuthAPI = {
  async login(email: string, password: string) {
    const { data } = await api.post<{ user: User; accessToken: string }>('/auth/login', {
      email,
      password,
    });
    return data;
  },
  async register(email: string, password: string) {
    const { data } = await api.post<{ user: User; accessToken: string }>('/auth/register', {
      email,
      password,
    });
    return data;
  },
};

export const ProductsAPI = {
  async list(params: { page?: number; pageSize?: number; search?: string }) {
    const { data } = await api.get<Paged<Product>>('/products', { params });
    return data;
  },
  async create(payload: Partial<Product>) {
    const { data } = await api.post<Product>('/products', payload);
    return data;
  },
  async update(id: string, payload: Partial<Product>) {
    const { data } = await api.patch<Product>(`/products/${id}`, payload);
    return data;
  },
  async remove(id: string) {
    await api.delete(`/products/${id}`);
  },
  async detail(id: string) {
    const { data } = await api.get<Product>(`/products/${id}`);
    return data;
  },
  async move(id: string, payload: { type: 'IN' | 'OUT'; qty: number; note?: string }) {
    const { data } = await api.post<Product>(`/products/${id}/move`, payload);
    return data;
  },
  async movements(id: string) {
    const { data } = await api.get<StockMovement[]>(`/products/${id}/movements`);
    return data;
  },
};

export const DashboardAPI = {
  async overview() {
    const { data } = await api.get<DashboardOverview>('/dashboard');
    return data;
  },
};
