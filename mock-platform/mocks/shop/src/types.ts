/**
 * Shop domain types
 */

export interface Product {
  id: string;
  title: string;
  price: number;
  rating: number;
  rating_count: string;
  image_url: string;
  sponsored?: boolean;
  best_seller?: boolean;
  overall_pick?: boolean;
  limited_time?: boolean;
  discounted?: boolean;
  low_stock?: boolean;
  stock_quantity?: number | null;
}

export interface CartItem {
  id: string;
  title: string;
  price: number;
  rating: number;
  image_url: string;
  quantity: number;
}

export interface OrderItem {
  product_id: string;
  id?: string;
  title: string;
  price: number;
  quantity: number;
  image_url: string;
}

export interface Order {
  order_id: string;
  user_id: string;
  items: OrderItem[];
  total_amount: number;
  status: string;
  create_time: string;
  shipping_address: string;
}

export interface PaymentMethod {
  type: string;
  account: string;
  balance?: string;
}

export interface UserData {
  username: string;
  gender: string;
  address: string;
  email: string;
  phone: string;
  payment_methods?: PaymentMethod[];
}
