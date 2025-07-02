// TypeScript API service for complex mixed project
import axios, { AxiosInstance } from 'axios';

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

export class ApiService {
  private client: AxiosInstance;

  constructor(private baseUrl: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async fetchUsers(): Promise<User[]> {
    const response = await this.client.get<ApiResponse<User[]>>('/users');
    return response.data.data;
  }

  async createUser(user: Omit<User, 'id'>): Promise<User> {
    const response = await this.client.post<ApiResponse<User>>('/users', user);
    return response.data.data;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const response = await this.client.patch<ApiResponse<User>>(`/users/${id}`, updates);
    return response.data.data;
  }

  async deleteUser(id: number): Promise<void> {
    await this.client.delete(`/users/${id}`);
  }

  isHealthy(): Promise<boolean> {
    return this.client.get('/health')
      .then(() => true)
      .catch(() => false);
  }
}