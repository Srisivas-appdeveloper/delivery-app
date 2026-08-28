import axios from 'axios';
import { ApiConstants } from '../constants/apiConstants';
import { Order, parseOrder } from '../models/Order';

export class ApiClient {
  private static instance: ApiClient;

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  async getOrders(): Promise<Order[]> {
    try {
      const response = await axios.get(ApiConstants.orders, { timeout: 6000 });
      if (Array.isArray(response.data)) {
        return response.data.map(parseOrder);
      }
      return [];
    } catch (error) {
      console.warn('[ApiClient] Failed to fetch orders:', error);
      return [];
    }
  }

  async getOrderById(id: string): Promise<Order | null> {
    try {
      const response = await axios.get(ApiConstants.orderById(id), { timeout: 6000 });
      return parseOrder(response.data);
    } catch (error) {
      console.warn(`[ApiClient] Failed to fetch order ${id}:`, error);
      return null;
    }
  }

  async updateOrderStatus(id: string, status: string): Promise<boolean> {
    try {
      await axios.put(ApiConstants.orderStatus(id), { status }, { timeout: 5000 });
      return true;
    } catch (error) {
      console.warn(`[ApiClient] Failed to update status for ${id}:`, error);
      return false;
    }
  }

  async updateLocation(
    id: string,
    latitude: number,
    longitude: number,
    heading: number = 0,
    speed: number = 0,
    accuracy: number = 5,
  ): Promise<boolean> {
    try {
      await axios.post(
        ApiConstants.orderLocation(id),
        {
          latitude,
          longitude,
          heading,
          speed,
          accuracy,
        },
        { timeout: 5000 },
      );
      return true;
    } catch (error) {
      console.warn(`[ApiClient] Failed to update location for ${id}:`, error);
      return false;
    }
  }

  async createOrder(orderData: Partial<Order>): Promise<Order | null> {
    try {
      const response = await axios.post(ApiConstants.orders, orderData, { timeout: 6000 });
      return parseOrder(response.data);
    } catch (error) {
      console.warn('[ApiClient] Failed to create order:', error);
      return null;
    }
  }
}

export const apiClient = ApiClient.getInstance();
