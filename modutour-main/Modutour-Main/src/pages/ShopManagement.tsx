import React, { useState, useEffect, useRef } from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Card } from '../components/ui/Card';
import { Input, Textarea } from '../components/ui/Input';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import FileUpload from '../components/ui/FileUpload';
import Pagination from '../components/ui/Pagination';

interface Product {
  id?: number;
  product_name: string;
  price: string;
  product_url: string;
  main_image: string;
  product_code: string;
  category: string;
  description: string;
  created_at?: string;
  updated_at?: string;
  is_hidden?: boolean;
  naver_ad_status?: string;
  registered_at?: string;
}

interface ApiResponse {
  success: boolean;
  data?: Product[] | { products?: Product[] };
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const ShopManagement: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'new' | 'registered'>('new');
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [newProducts, setNewProducts] = useState<Product[]>([]);
  const [registeredProducts, setRegisteredProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastCrawlTime, setLastCrawlTime] = useState<string>('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [error, setError] = useState<string>('');

  const [editableFields, setEditableFields] = useState({
    product_name: '',
    category: '',
    description: ''
  });

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const API_BASE_URL = 'https://modetour.name/api';
  const isInitialMount = useRef(true);
  const crawlingInterval = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const ITEMS_PER_PAGE = 14;

  // ⭐ AbortController를 사용한 안전한 fetch 함수
  const fetchWithErrorHandling = async (url: string, options: RequestInit = {}): Promise<ApiResponse> => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setError('');
      
      console.log(`API 요청 시작: ${url}`);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        credentials: 'include',
        mode: 'cors',
        signal: controller.signal
      });

      console.log(`API 응답 상태: ${response.status}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: ApiResponse = await response.json();
      console.log(`API 응답 데이터:`, result);
      
      if (!result.success) {
        throw new Error(result.message || result.error || '알 수 없는 오류가 발생했습니다.');
      }

      return result;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('요청이 취소되었습니다.');
        throw error;
      }

      let errorMessage = '네트워크 오류가 발생했습니다.';
      
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          errorMessage = '서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.';
        } else if (error.message.includes('ERR_CONNECTION_REFUSED')) {
          errorMessage = '서버 연결이 거부되었습니다. 포트 5001이 열려있는지 확인해주세요.';
        } else {
          errorMessage = error.message;
        }
      }
      
      console.error('API 요청 실패:', errorMessage);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // ⭐ 안전한 배열 추출 함수
  const extractProductsArray = (data: any): Product[] => {
    try {
      if (Array.isArray(data)) {
        return data;
      }
      
      if (data && Array.isArray(data.products)) {
        return data.products;
      }
      
      if (data && Array.isArray(data.data)) {
        return data.data;
      }
      
      console.warn('예상하지 못한 API 응답 구조:', data);
      return [];
    } catch (error) {
      console.error('상품 배열 추출 실패:', error);
      return [];
    }
  };

  const allProducts = activeTab === 'new' 
    ? newProducts 
    : registeredProducts.filter(product => !product.is_hidden);
  
  const getCurrentPageProducts = () => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return allProducts.slice(startIndex, endIndex);
  };

  const currentProducts = getCurrentPageProducts();
  const totalPages = Math.ceil(allProducts.length / ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedRowIndex(null);
    setSelectedProduct(null);
    setEditableFields({ product_name: '', category: '', description: '' });
    setIsEditMode(false);
    setEditingProduct(null);
  };

  // ⭐ 개선된 신규 상품 조회
  const fetchNewProducts = async () => {
    try {
      console.log('신규 상품 조회 시작...');
      
      const result = await fetchWithErrorHandling(
        `${API_BASE_URL}/products/new?page=${currentPage}&limit=${ITEMS_PER_PAGE}&t=${Date.now()}`
      );
      
      const products = extractProductsArray(result.data);
      
      setNewProducts(products);
      console.log(`신규 상품 ${products.length}개 로딩 완료`);
      
      if (result.pagination) {
        const newTotalPages = result.pagination.totalPages;
        if (currentPage > newTotalPages && newTotalPages > 0) {
          setCurrentPage(1);
        }
      }
      
      if (products.length > 0 && activeTab !== 'new') {
        setActiveTab('new');
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('신규 상품 조회 오류:', error);
        setNewProducts([]);
      }
    }
  };

// ⭐ 등록된 상품 조회 함수 수정
const fetchRegisteredProducts = async () => {
  try {
    console.log('등록된 상품 조회 시작...');
    
    // ⭐ 현재 페이지와 페이지당 아이템 수를 사용하도록 수정
    const result = await fetchWithErrorHandling(
      `${API_BASE_URL}/products/registered?page=${currentPage}&limit=${ITEMS_PER_PAGE}&t=${Date.now()}`
    );
    
    console.log('등록된 상품 API 응답:', result);
    
    const products = extractProductsArray(result.data);
    
    setRegisteredProducts(products);
    console.log(`등록된 상품 ${products.length}개 조회 완료`);
    
    // 페이지 조정 (등록된 상품은 숨김 필터링 불필요)
    if (result.pagination) {
      const newTotalPages = result.pagination.totalPages;
      if (currentPage > newTotalPages && newTotalPages > 0) {
        setCurrentPage(1);
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError') {
      console.error('등록된 상품 조회 오류:', error);
      setRegisteredProducts([]);
    }
  }
};


  // ⭐ 크롤링 상태 확인
  const fetchCrawlStatus = async () => {
    try {
      const result = await fetchWithErrorHandling(`${API_BASE_URL}/crawl/status`);
      
      if (result.data && typeof result.data === 'object') {
        const statusData = result.data as any;
        if (statusData.timestamp || statusData.lastUpdate) {
          setLastCrawlTime(statusData.timestamp || statusData.lastUpdate);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('크롤링 상태 확인 오류:', error);
      }
    }
  };

  // ⭐ StrictMode를 고려한 useEffect
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      console.log('컴포넌트 초기 마운트 - 데이터 로딩 시작');
      
      const initializeData = async () => {
        try {
          await Promise.allSettled([
            fetchNewProducts(),
            fetchRegisteredProducts(),
            fetchCrawlStatus()
          ]);
        } catch (error) {
          console.error('초기 데이터 로딩 실패:', error);
        }
      };
      
      initializeData();
    }

    return () => {
      if (crawlingInterval.current) {
        clearInterval(crawlingInterval.current);
        crawlingInterval.current = null;
      }
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // ⭐ 크롤링 시작 함수
  const handleCrawlNewProducts = async () => {
    if (isLoading) {
      console.log('이미 크롤링 중입니다.');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      console.log('수동 크롤링 시작 요청...');
      
      const result = await fetchWithErrorHandling(`${API_BASE_URL}/crawl/start`, {
        method: 'POST',
      });
      
      if (result.success) {
        alert('신규 상품 크롤링이 시작되었습니다.');
        
        if (crawlingInterval.current) {
          clearInterval(crawlingInterval.current);
        }
        
        let checkCount = 0;
        const maxChecks = 20;
        
        crawlingInterval.current = setInterval(async () => {
          checkCount++;
          
          try {
            console.log(`크롤링 완료 확인 중... (${checkCount}/${maxChecks})`);
            
            const statusResult = await fetchWithErrorHandling(`${API_BASE_URL}/crawl/status`);
            
            if (statusResult.success && statusResult.data) {
              const statusData = statusResult.data as any;
              
              if (statusData.productCount > 0 || statusData.recentProducts > 0) {
                if (crawlingInterval.current) {
                  clearInterval(crawlingInterval.current);
                  crawlingInterval.current = null;
                }
                
                setIsLoading(false);
                await fetchNewProducts();
                await fetchCrawlStatus();
                
                const productCount = statusData.productCount || statusData.recentProducts || 0;
                alert(`${productCount}개의 신규 상품이 수집되었습니다.`);
                setActiveTab('new');
                setCurrentPage(1);
                return;
              }
            }
            
            if (checkCount >= maxChecks) {
              if (crawlingInterval.current) {
                clearInterval(crawlingInterval.current);
                crawlingInterval.current = null;
              }
              
              setIsLoading(false);
              await fetchNewProducts();
              await fetchCrawlStatus();
              alert('크롤링이 완료되었습니다. 상품 목록을 확인해주세요.');
            }
          } catch (error) {
            console.error('크롤링 상태 확인 오류:', error);
          }
        }, 5000);
        
      } else {
        throw new Error(result.message || '크롤링 시작 실패');
      }
    } catch (error) {
      console.error('크롤링 요청 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '크롤링 요청 중 오류가 발생했습니다.';
      alert(errorMessage);
      setIsLoading(false);
    }
  };

  const handleTabChange = (tab: 'new' | 'registered') => {
    setActiveTab(tab);
    setSelectedRowIndex(null);
    setSelectedProduct(null);
    setEditableFields({ product_name: '', category: '', description: '' });
    setIsEditMode(false);
    setEditingProduct(null);
    setCurrentPage(1);
    setError('');
    
    if (tab === 'new') {
      fetchNewProducts();
    } else {
      fetchRegisteredProducts();
    }
  };

  const handleProductClick = (index: number) => {
    try {
      setSelectedRowIndex(index);
      const product = currentProducts[index];
      
      if (!product) {
        console.error('선택된 상품이 존재하지 않습니다:', index);
        return;
      }
      
      setSelectedProduct(product);
      setIsEditMode(false);
      setEditingProduct(null);
      setError('');
      
      if (activeTab === 'new') {
        setEditableFields({
          product_name: product.product_name || '',
          category: product.category || '',
          description: product.description || ''
        });
      }
    } catch (error) {
      console.error('상품 선택 오류:', error);
      setError('상품 선택 중 오류가 발생했습니다.');
    }
  };

  // handleSaveProduct 함수 수정
const handleSaveProduct = async () => {
  if (!selectedProduct) {
    alert('저장할 상품을 선택해주세요.');
    return;
  }

  if (activeTab === 'new' && selectedProduct.id) {
    try {
      setError('');
      
      // 유효성 검사
      if (!editableFields.product_name.trim()) {
        alert('상품명을 입력해주세요.');
        return;
      }

      // ⭐ 새로운 API 엔드포인트 사용
      const result = await fetchWithErrorHandling(`${API_BASE_URL}/products/save-and-register`, {
        method: 'POST',
        body: JSON.stringify({
          id: selectedProduct.id,
          product_name: editableFields.product_name.trim(),
          category: editableFields.category.trim(),
          description: editableFields.description.trim(),
          price: selectedProduct.price
        })
      });

      if (result.success) {
        alert('상품이 저장 후 등록되었습니다.');
        
        // 두 탭 모두 새로고침
        await Promise.allSettled([
          fetchNewProducts(),
          fetchRegisteredProducts()
        ]);
        
        setSelectedProduct(null);
        setSelectedRowIndex(null);
        setEditableFields({ product_name: '', category: '', description: '' });
      }
    } catch (error) {
      console.error('상품 등록 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '상품 등록 중 오류가 발생했습니다.';
      alert(errorMessage);
    }
  } else {
    alert('등록할 수 있는 신규 상품을 선택해주세요.');
  }
};


  const handleEditProduct = () => {
    if (!selectedProduct) {
      alert('수정할 상품을 선택해주세요.');
      return;
    }
    
    setIsEditMode(true);
    setEditingProduct({ ...selectedProduct });
    setError('');
  };

  const handleSaveEdit = async () => {
    if (!editingProduct || !editingProduct.id) {
      alert('수정할 상품 정보가 없습니다.');
      return;
    }

    try {
      setError('');
      
      if (!editingProduct.product_name.trim()) {
        alert('상품명을 입력해주세요.');
        return;
      }

      const result = await fetchWithErrorHandling(`${API_BASE_URL}/products/registered/${editingProduct.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          product_name: editingProduct.product_name.trim(),
          category: editingProduct.category.trim(),
          description: editingProduct.description.trim(),
          price: editingProduct.price
        })
      });

      if (result.success) {
        alert('상품이 수정되었습니다.');
        
        await fetchRegisteredProducts();
        setIsEditMode(false);
        setEditingProduct(null);
        setSelectedProduct(editingProduct);
      }
    } catch (error) {
      console.error('상품 수정 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '상품 수정 중 오류가 발생했습니다.';
      alert(errorMessage);
    }
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct || !selectedProduct.id) {
      alert('삭제할 상품을 선택해주세요.');
      return;
    }

    if (confirm('정말로 이 상품을 삭제하시겠습니까?')) {
      try {
        setError('');
        
        const result = await fetchWithErrorHandling(`${API_BASE_URL}/products/registered/${selectedProduct.id}`, {
          method: 'DELETE'
        });

        if (result.success) {
          alert('상품이 삭제되었습니다.');
          
          await fetchRegisteredProducts();
          setSelectedProduct(null);
          setSelectedRowIndex(null);
          setIsEditMode(false);
          setEditingProduct(null);
        }
      } catch (error) {
        console.error('상품 삭제 오류:', error);
        const errorMessage = error instanceof Error ? error.message : '상품 삭제 중 오류가 발생했습니다.';
        alert(errorMessage);
      }
    }
  };

  const handleResetForm = () => {
    try {
      if (activeTab === 'new' && selectedProduct) {
        setEditableFields({
          product_name: selectedProduct.product_name || '',
          category: selectedProduct.category || '',
          description: selectedProduct.description || ''
        });
      } else if (activeTab === 'registered' && isEditMode && selectedProduct) {
        setEditingProduct({ ...selectedProduct });
      } else {
        setSelectedProduct(null);
        setSelectedRowIndex(null);
        setEditableFields({ product_name: '', category: '', description: '' });
        setIsEditMode(false);
        setEditingProduct(null);
      }
      setError('');
    } catch (error) {
      console.error('폼 초기화 오류:', error);
    }
  };

  const getDisplayProduct = (): Product | null => {
    try {
      if (activeTab === 'registered' && isEditMode && editingProduct) {
        return editingProduct;
      }
      return selectedProduct;
    } catch (error) {
      console.error('표시 상품 결정 오류:', error);
      return null;
    }
  };

  const displayProduct = getDisplayProduct();

  return (
    <div className="bg-white">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">상품 관리</h1>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${error.includes('서버') ? 'bg-red-500' : 'bg-green-500'}`}></div>
          <span className="text-sm text-gray-600">
            {error.includes('서버') ? '서버 연결 실패' : '서버 연결됨'}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <div className="text-sm text-red-700">
              <strong>오류:</strong> {error}
              {error.includes('서버') && (
                <div className="mt-2">
                  <strong>해결 방법:</strong>
                  <ul className="list-disc list-inside mt-1">
                    <li>백엔드 서버가 실행 중인지 확인하세요 (포트 5001)</li>
                    <li>터미널에서 <code>npm start</code> 명령어로 서버를 시작하세요</li>
                    <li>방화벽이 포트 5001을 차단하고 있지 않은지 확인하세요</li>
                  </ul>
                </div>
              )}
            </div>
            <button
              onClick={() => setError('')}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-8">
          <button
            onClick={() => handleTabChange('new')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'new' 
                ? 'text-blue-600 border-blue-600' 
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            신규 등록 ({newProducts.length})
          </button>
          <button
            onClick={() => handleTabChange('registered')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'registered' 
                ? 'text-blue-600 border-blue-600' 
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            등록된 상품 ({registeredProducts.filter(p => !p.is_hidden).length})
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="new-product" 
          onClick={handleCrawlNewProducts}
          disabled={isLoading}
        >
          {isLoading ? '크롤링 중...' : '신규 상품 불러오기'}
        </Button>
        <div className="text-sm text-gray-500">
          최근 수집: {lastCrawlTime || '데이터 없음'}
        </div>
      </div>

      <div className="flex gap-8">
        <div className="flex-1 max-w-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead width={352}>상품명</TableHead>
                <TableHead width={104}>가격</TableHead>
                <TableHead width={129}>상품코드</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentProducts.length > 0 ? (
                currentProducts.map((product, index) => (
                  <TableRow 
                    key={product.id || `${product.product_code}-${index}`}
                    onClick={() => handleProductClick(index)}
                    isSelected={selectedRowIndex === index}
                  >
                    <TableCell ellipsis={true} title={product.product_name}>
                      {product.product_name || '상품명 없음'}
                    </TableCell>
                    <TableCell>{product.price ? `${product.price}원` : '가격 없음'}</TableCell>
                    <TableCell>{product.product_code || '코드 없음'}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-gray-500 py-8">
                    {activeTab === 'new' 
                      ? '신규 상품이 없습니다. "신규 상품 불러오기" 버튼을 클릭해주세요.' 
                      : '등록된 상품이 없습니다. 신규 등록 탭에서 상품을 등록해주세요.'
                    }
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages || 1}
            onPageChange={handlePageChange}
            className="mt-6"
          />
        </div>

        <div 
          className="bg-white border border-gray-200"
          style={{
            width: '943px',
            height: '800px',
            borderRadius: '6px',
            borderWidth: '1px',
            paddingTop: '16px',
            paddingRight: '32px',
            paddingBottom: '16px',
            paddingLeft: '32px',
          }}
        >
          <div className="space-y-4">
            <Input
              label="상품명"
              value={
                activeTab === 'new' 
                  ? editableFields.product_name 
                  : (isEditMode && editingProduct ? editingProduct.product_name : (displayProduct?.product_name || ''))
              }
              placeholder="상품을 선택하면 정보가 표시됩니다"
              helpText="100자 이내 / 특수문자 사용 금지 (!,@,# 등) / 광고성 표현 금지 (예: 최저가, 단하루 등)"
              variant="product-name"
              disabled={activeTab === 'registered' && !isEditMode}
              onChange={(e) => {
                try {
                  if (activeTab === 'new') {
                    setEditableFields(prev => ({ ...prev, product_name: e.target.value }));
                  } else if (isEditMode && editingProduct) {
                    setEditingProduct(prev => prev ? { ...prev, product_name: e.target.value } : null);
                  }
                } catch (error) {
                  console.error('상품명 변경 오류:', error);
                }
              }}
            />

            <Input
              label="가격"
              value={
                isEditMode && editingProduct 
                  ? editingProduct.price 
                  : (displayProduct?.price || '')
              }
              placeholder="가격"
              variant="price"
              disabled={activeTab === 'new' || !isEditMode}
              onChange={(e) => {
                try {
                  if (isEditMode && editingProduct) {
                    setEditingProduct(prev => prev ? { ...prev, price: e.target.value } : null);
                  }
                } catch (error) {
                  console.error('가격 변경 오류:', error);
                }
              }}
            />

            <Input
              label="상품 링크"
              value={
                isEditMode && editingProduct 
                  ? editingProduct.product_url 
                  : (displayProduct?.product_url || '')
              }
              placeholder="상품 링크"
              variant="product-link"
              disabled={activeTab === 'new' || !isEditMode}
              onChange={(e) => {
                try {
                  if (isEditMode && editingProduct) {
                    setEditingProduct(prev => prev ? { ...prev, product_url: e.target.value } : null);
                  }
                } catch (error) {
                  console.error('상품 링크 변경 오류:', error);
                }
              }}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">대표 이미지</label>
              {displayProduct?.main_image ? (
                <div className="flex items-center gap-4">
                  <img 
                    src={displayProduct.main_image} 
                    alt="상품 이미지" 
                    className="w-20 h-20 object-cover rounded border"
                    onError={(e) => {
                      e.currentTarget.src = '/placeholder-image.png';
                    }}
                  />
                  <div className="text-sm text-gray-600 break-all">
                    {displayProduct.main_image}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">
                  이미지를 선택해주세요 {activeTab === 'new' || !isEditMode ? '(편집 불가)' : ''}
                </div>
              )}
            </div>

            <Input
              label="상품코드"
              value={
                isEditMode && editingProduct 
                  ? editingProduct.product_code 
                  : (displayProduct?.product_code || '')
              }
              placeholder="상품코드"
              variant="product-code"
              disabled={true}
              onChange={() => {}}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">상품 카테고리</label>
              <div className="grid grid-cols-3 gap-2">
                <Select 
                  value={
                    activeTab === 'new' 
                      ? editableFields.category 
                      : (isEditMode && editingProduct ? editingProduct.category : (displayProduct?.category || ''))
                  }
                  disabled={activeTab === 'registered' && !isEditMode}
                  onChange={(e) => {
                    try {
                      if (activeTab === 'new') {
                        setEditableFields(prev => ({ ...prev, category: e.target.value }));
                      } else if (isEditMode && editingProduct) {
                        setEditingProduct(prev => prev ? { ...prev, category: e.target.value } : null);
                      }
                    } catch (error) {
                      console.error('카테고리 변경 오류:', error);
                    }
                  }}
                >
                  <option value="">카테고리 선택</option>
                  <option value="여행/항공/여의">여행/항공/여의</option>
                  <option value="해외여행">해외여행</option>
                  <option value="국내여행">국내여행</option>
                </Select>
                <Select disabled={true}>
                  <option>세부 카테고리</option>
                </Select>
                <Select disabled={true}>
                  <option>상세 분류</option>
                </Select>
              </div>
            </div>

            <Textarea
              label="상품설명"
              value={
                activeTab === 'new' 
                  ? editableFields.description 
                  : (isEditMode && editingProduct ? editingProduct.description : (displayProduct?.description || ''))
              }
              placeholder="상품 설명"
              helpText="HTML 태그 불가 / 1000자 이내 권장"
              variant="product-description"
              disabled={activeTab === 'registered' && !isEditMode}
              onChange={(e) => {
                try {
                  if (activeTab === 'new') {
                    setEditableFields(prev => ({ ...prev, description: e.target.value }));
                  } else if (isEditMode && editingProduct) {
                    setEditingProduct(prev => prev ? { ...prev, description: e.target.value } : null);
                  }
                } catch (error) {
                  console.error('상품 설명 변경 오류:', error);
                }
              }}
            />

            <div className="flex gap-2 mt-8">
              {activeTab === 'new' ? (
                <>
                  <Button 
                    variant="save" 
                    onClick={handleSaveProduct}
                    disabled={!selectedProduct || isLoading}
                  >
                    저장 후 등록
                  </Button>
                  <Button 
                    variant="reset" 
                    onClick={handleResetForm}
                    disabled={isLoading}
                  >
                    초기화
                  </Button>
                </>
              ) : (
                <>
                  {isEditMode ? (
                    <>
                      <Button 
                        variant="save" 
                        onClick={handleSaveEdit}
                        disabled={!editingProduct || isLoading}
                      >
                        저장
                      </Button>
                      <Button 
                        variant="reset" 
                        onClick={handleResetForm}
                        disabled={isLoading}
                      >
                        취소
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button 
                        variant="edit" 
                        onClick={handleEditProduct}
                        disabled={!selectedProduct || isLoading}
                      >
                        수정
                      </Button>
                      <Button 
                        variant="delete" 
                        onClick={handleDeleteProduct}
                        disabled={!selectedProduct || isLoading}
                      >
                        삭제
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopManagement;
