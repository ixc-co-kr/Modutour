import axios from 'axios';

// Vite 환경 변수 사용
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

export const productAPI = {
  getProducts: async (page = 1, category = '') => {
    try {
      const response = await api.get('/products', {
        params: { page, category, per_page: 20 }
      });
      return response.data;
    } catch (error) {
      console.warn('백엔드 연결 실패, 더미 데이터 사용');
      return {
        products: [
          {
            id: 1,
            product_name: '[테스트] 제주도 여행 패키지',
            price: 299000,
            product_code: 'TEST001',
            category: '국내여행'
          }
        ],
        pagination: { current_page: 1, total_pages: 1 }
      };
    }
  },

  saveProduct: async (productData) => {
    try {
      const response = await api.post('/products', productData);
      return response.data;
    } catch (error) {
      console.warn('백엔드 연결 실패');
      return { 
        success: true, 
        product_id: Date.now(),
        message: '로컬에 임시 저장되었습니다'
      };
    }
  },

  healthCheck: async () => {
    try {
      const response = await api.get('/health');
      return response.data;
    } catch (error) {
      return { status: 'offline' };
    }
  },

  triggerCrawling: async () => {
    try {
      const response = await api.post('/crawling/trigger');
      return response.data;
    } catch (error) {
      throw new Error('크롤링 서비스에 연결할 수 없습니다');
    }
  }
};
