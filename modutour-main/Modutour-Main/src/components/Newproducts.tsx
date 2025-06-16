// src/components/NewProducts.tsx (수정된 버전)
import React, { useState, useEffect } from 'react';
import Button from './ui/Button';
import {Input} from './ui/Input';

interface Product {
  id: number;
  product_code: string;
  product_name: string;
  price: string;
  product_url: string;
  main_image: string;
  category: string;
  description: string;
  created_at: string;
}

interface ProductEditModalProps {
  product: Product;
  onSave: (productId: number, updatedData: any) => Promise<void>;
  onClose: () => void;
}

// ⭐ 수정된 상품 수정 모달
const ProductEditModal: React.FC<ProductEditModalProps> = ({ product, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    product_name: '',
    category: '',
    description: '',
    price: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  // ⭐ 초기값 설정 (product가 변경될 때마다)
  useEffect(() => {
    if (product) {
      setFormData({
        product_name: product.product_name || '',
        category: product.category || '',
        description: product.description || '',
        price: product.price || ''
      });
    }
  }, [product]);

  // ⭐ 입력값 변경 핸들러 (제어 컴포넌트)
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // ⭐ 저장 핸들러
  const handleSave = async () => {
    if (!formData.product_name.trim()) {
      alert('상품명을 입력해주세요.');
      return;
    }

    try {
      setIsLoading(true);
      await onSave(product.id, formData);
      alert('상품이 성공적으로 수정되었습니다.');
      onClose();
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">상품 정보 수정</h2>
        
        <div className="space-y-4">
          {/* 상품명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              상품명 *
            </label>
            <Input
              type="text"
              value={formData.product_name}
              onChange={(e) => handleInputChange('product_name', e.target.value)}
              placeholder="상품명을 입력하세요"
              className="w-full"
              disabled={isLoading}
            />
          </div>

          {/* 카테고리 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              카테고리
            </label>
            <Input
              type="text"
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
              placeholder="카테고리를 입력하세요"
              className="w-full"
              disabled={isLoading}
            />
          </div>

          {/* 상품 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              상품 설명
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              placeholder="상품 설명을 입력하세요"
              disabled={isLoading}
            />
          </div>

          {/* 가격 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              가격
            </label>
            <Input
              type="text"
              value={formData.price}
              onChange={(e) => handleInputChange('price', e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="가격을 입력하세요 (숫자만)"
              className="w-full"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex justify-end space-x-2 mt-6">
          <Button
            onClick={onClose}
            variant="outline"
            disabled={isLoading}
          >
            취소
          </Button>
          <Button
            onClick={handleSave}
            variant="save"
            disabled={isLoading}
          >
            {isLoading ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ⭐ 메인 NewProducts 컴포넌트
const NewProducts: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // 상품 목록 로드
  const loadProducts = async (page = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/products/new?page=${page}&limit=20`);
      const result = await response.json();
      
      if (result.success) {
        setProducts(result.data.products);
        setTotalPages(result.data.pagination.totalPages);
        setCurrentPage(page);
      } else {
        console.error('상품 목록 로드 실패:', result.message);
      }
    } catch (error) {
      console.error('상품 목록 로드 실패:', error);
      alert('상품 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ⭐ 상품 수정 (올바른 API 엔드포인트 사용)
  const handleUpdateProduct = async (productId: number, updatedData: any): Promise<void> => {
    try {
      console.log('상품 수정 요청:', { productId, updatedData });
      
      const response = await fetch(`/api/products/new/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log('상품 수정 성공:', result);
        // 목록 새로고침
        await loadProducts(currentPage);
      } else {
        throw new Error(result.message || '상품 수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('상품 수정 실패:', error);
      throw error; // 에러를 다시 던져서 모달에서 처리하도록
    }
  };

  // 저장 후 등록
  const handleRegisterSelected = async () => {
    if (selectedProducts.length === 0) {
      alert('등록할 상품을 선택해주세요.');
      return;
    }

    if (!confirm(`선택한 ${selectedProducts.length}개 상품을 등록하시겠습니까?`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/products/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productCodes: selectedProducts })
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`${result.data.summary.success}개 상품이 성공적으로 등록되었습니다.`);
        setSelectedProducts([]);
        await loadProducts(currentPage);
      } else {
        alert(`등록 실패: ${result.message}`);
      }
    } catch (error) {
      console.error('상품 등록 실패:', error);
      alert('상품 등록 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 전체 선택/해제
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(products.map(p => p.product_code));
    } else {
      setSelectedProducts([]);
    }
  };

  // 개별 선택/해제
  const handleSelectProduct = (productCode: string, checked: boolean) => {
    if (checked) {
      setSelectedProducts(prev => [...prev, productCode]);
    } else {
      setSelectedProducts(prev => prev.filter(code => code !== productCode));
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">신규 등록</h2>
          <p className="text-sm text-gray-600 mt-1">
            크롤링된 신규 상품을 확인하고 등록하세요
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={() => loadProducts(currentPage)}
            variant="outline"
            disabled={loading}
          >
            새로고침
          </Button>
          <Button
            onClick={handleRegisterSelected}
            disabled={selectedProducts.length === 0 || loading}
            variant="save"
          >
            {loading ? '등록 중...' : `저장 후 등록 (${selectedProducts.length}개)`}
          </Button>
        </div>
      </div>

      {/* 상품 테이블 */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={selectedProducts.length === products.length && products.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                상품정보
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                가격
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                액션
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                  로딩 중...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                  등록할 신규 상품이 없습니다.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(product.product_code)}
                      onChange={(e) => handleSelectProduct(product.product_code, e.target.checked)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <img
                        className="h-16 w-16 rounded-lg object-cover"
                        src={product.main_image || '/placeholder.jpg'}
                        alt={product.product_name}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder.jpg';
                        }}
                      />
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 line-clamp-2">
                          {product.product_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {product.product_code}
                        </div>
                        <div className="text-xs text-gray-400">
                          {product.category}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {parseInt(product.price).toLocaleString()}원
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => setEditingProduct(product)}
                        variant="edit"
                      >
                        수정
                      </Button>
                        <Button
                        onClick={() => void window.open(product.product_url, '_blank')}
                        variant="outline"
                        >
                        보기
                        </Button>

                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2">
          <Button
            onClick={() => loadProducts(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1 || loading}
            variant="outline"
          >
            이전
          </Button>
          <span className="px-3 py-2 text-sm text-gray-700">
            {currentPage} / {totalPages}
          </span>
          <Button
            onClick={() => loadProducts(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages || loading}
            variant="outline"
          >
            다음
          </Button>
        </div>
      )}

      {/* 수정 모달 */}
      {editingProduct && (
        <ProductEditModal
          product={editingProduct}
          onSave={handleUpdateProduct}
          onClose={() => setEditingProduct(null)}
        />
      )}
    </div>
  );
};

export default NewProducts;
