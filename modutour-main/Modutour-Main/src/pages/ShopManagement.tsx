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

  // 편집 가능한 필드만 관리하는 상태 (신규 등록 탭용)
  const [editableFields, setEditableFields] = useState({
    product_name: '',
    category: '',
    description: ''
  });

  // 등록된 상품 탭에서 수정 시 사용할 상태
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const API_BASE_URL = 'http://localhost:5001/api';
  const isInitialMount = useRef(true);
  const crawlingInterval = useRef<any>(null);
  
  // 페이지당 표시할 아이템 수
  const ITEMS_PER_PAGE = 14;

  // ⭐ CORS 대응 fetch 함수 개선
  const fetchWithCors = async (url: string, options: RequestInit = {}) => {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        credentials: 'include',
        mode: 'cors'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      console.error('API 요청 실패:', error);
      throw error;
    }
  };

  // 현재 탭의 전체 상품 목록 (숨김 상품 제외)
  const allProducts = activeTab === 'new' 
    ? newProducts 
    : registeredProducts.filter(product => !product.is_hidden);
  
  // 현재 페이지에 표시할 상품들 계산
  const getCurrentPageProducts = () => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return allProducts.slice(startIndex, endIndex);
  };

  // 현재 페이지의 상품 목록
  const currentProducts = getCurrentPageProducts();
  
  // 전체 페이지 수 계산
  const totalPages = Math.ceil(allProducts.length / ITEMS_PER_PAGE);

  // 페이지 변경 핸들러
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedRowIndex(null);
    setSelectedProduct(null);
    setEditableFields({ product_name: '', category: '', description: '' });
    setIsEditMode(false);
    setEditingProduct(null);
  };

  // ⭐ 신규 상품 조회 개선
  const fetchNewProducts = async () => {
    try {
      console.log('신규 상품 조회 시작...');
      
      const response = await fetchWithCors(`${API_BASE_URL}/products/new?t=${Date.now()}`);
      const result = await response.json();
      
      console.log('신규 상품 API 응답:', result);
      
      if (result.success && result.data) {
        // ⭐ API 응답 구조 확인 후 배열 설정
        const products = Array.isArray(result.data) ? result.data : 
                        (result.data.products && Array.isArray(result.data.products) ? result.data.products : []);
        
        setNewProducts(products);
        console.log(`신규 상품 ${products.length}개 로딩 완료`);
        
        const newTotalPages = Math.ceil(products.length / ITEMS_PER_PAGE);
        if (currentPage > newTotalPages && newTotalPages > 0) {
          setCurrentPage(1);
        }
        
        if (products.length > 0 && activeTab !== 'new') {
          setActiveTab('new');
        }
      } else {
        console.error('신규 상품 조회 실패:', result.message);
        setNewProducts([]);
      }
    } catch (error) {
      console.error('신규 상품 조회 오류:', error);
      setNewProducts([]);
    }
  };

  // ⭐ 등록된 상품 조회 개선
  const fetchRegisteredProducts = async () => {
    try {
      const response = await fetchWithCors(`${API_BASE_URL}/products/registered`);
      const result = await response.json();
      
      if (result.success && result.data) {
        // ⭐ API 응답 구조 확인 후 배열 설정
        const products = Array.isArray(result.data) ? result.data : 
                        (result.data.products && Array.isArray(result.data.products) ? result.data.products : []);
        
        setRegisteredProducts(products);
        console.log(`등록된 상품 ${products.length}개 조회 완료`);
        
        const visibleProducts = products.filter((product: Product) => !product.is_hidden);
        const newTotalPages = Math.ceil(visibleProducts.length / ITEMS_PER_PAGE);
        if (currentPage > newTotalPages && newTotalPages > 0) {
          setCurrentPage(1);
        }
      } else {
        console.error('등록된 상품 조회 실패:', result.message);
        setRegisteredProducts([]);
      }
    } catch (error) {
      console.error('등록된 상품 조회 오류:', error);
      setRegisteredProducts([]);
    }
  };

  // 크롤링 상태 확인
  const fetchCrawlStatus = async () => {
    try {
      const response = await fetchWithCors(`${API_BASE_URL}/crawl/status`);
      const result = await response.json();
      
      if (result.success && result.lastUpdate) {
        setLastCrawlTime(result.lastUpdate);
      }
    } catch (error) {
      console.error('크롤링 상태 확인 오류:', error);
    }
  };

  // 신규 상품 크롤링 시작
  const handleCrawlNewProducts = async () => {
    if (isLoading) {
      console.log('이미 크롤링 중입니다.');
      return;
    }
    
    setIsLoading(true);
    
    try {
      console.log('수동 크롤링 시작 요청...');
      
      const response = await fetchWithCors(`${API_BASE_URL}/crawl/start`, {
        method: 'POST',
      });
      
      const result = await response.json();
      
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
            
            const statusResponse = await fetchWithCors(`${API_BASE_URL}/crawl/status`);
            const statusResult = await statusResponse.json();
            
            if (statusResult.success && statusResult.productCount > 0) {
              if (crawlingInterval.current) {
                clearInterval(crawlingInterval.current);
                crawlingInterval.current = null;
              }
              
              setIsLoading(false);
              await fetchNewProducts();
              await fetchCrawlStatus();
              alert(`${statusResult.productCount}개의 신규 상품이 수집되었습니다.`);
              setActiveTab('new');
              setCurrentPage(1);
              return;
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
        }, 5000) as any;
        
      } else {
        alert('크롤링 시작 실패: ' + result.message);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('크롤링 요청 오류:', error);
      alert('크롤링 요청 중 오류가 발생했습니다.');
      setIsLoading(false);
    }
  };

  // 컴포넌트 마운트 시에만 실행
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      console.log('컴포넌트 초기 마운트 - 데이터 로딩 시작');
      
      fetchNewProducts();
      fetchRegisteredProducts();
      fetchCrawlStatus();
    }

    return () => {
      if (crawlingInterval.current) {
        clearInterval(crawlingInterval.current);
        crawlingInterval.current = null;
      }
    };
  }, []);

  // 탭 변경 시 데이터 새로고침 및 페이지 초기화
  const handleTabChange = (tab: 'new' | 'registered') => {
    setActiveTab(tab);
    setSelectedRowIndex(null);
    setSelectedProduct(null);
    setEditableFields({ product_name: '', category: '', description: '' });
    setIsEditMode(false);
    setEditingProduct(null);
    setCurrentPage(1);
    
    if (tab === 'new') {
      fetchNewProducts();
    } else {
      fetchRegisteredProducts();
    }
  };

  // 상품 행 클릭 처리
  const handleProductClick = (index: number) => {
    setSelectedRowIndex(index);
    const product = currentProducts[index];
    setSelectedProduct(product);
    setIsEditMode(false);
    setEditingProduct(null);
    
    // 신규 등록 탭에서는 편집 가능한 필드만 설정
    if (activeTab === 'new') {
      setEditableFields({
        product_name: product.product_name,
        category: product.category,
        description: product.description
      });
    }
  };

  // ⭐ 상품 저장 후 등록 개선 (신규 등록 탭)
  const handleSaveProduct = async () => {
    if (!selectedProduct) {
      alert('저장할 상품을 선택해주세요.');
      return;
    }

    if (activeTab === 'new' && selectedProduct.id) {
      try {
        // 1. 먼저 상품 정보 업데이트
        const updatedData = {
          product_name: editableFields.product_name,
          category: editableFields.category,
          description: editableFields.description,
          price: selectedProduct.price
        };

        const updateResponse = await fetchWithCors(`${API_BASE_URL}/products/new/${selectedProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify(updatedData)
        });

        const updateResult = await updateResponse.json();
        
        if (!updateResult.success) {
          throw new Error(updateResult.message || '상품 정보 업데이트 실패');
        }

        // 2. 상품 등록
        const registerResponse = await fetchWithCors(`${API_BASE_URL}/products/register`, {
          method: 'POST',
          body: JSON.stringify({ productCodes: [selectedProduct.product_code] })
        });

        const registerResult = await registerResponse.json();
        
        if (registerResult.success) {
          alert('상품이 저장 후 등록되었습니다.');
          
          await fetchNewProducts();
          await fetchRegisteredProducts();
          
          setSelectedProduct(null);
          setSelectedRowIndex(null);
          setEditableFields({ product_name: '', category: '', description: '' });
        } else {
          alert('상품 등록 실패: ' + registerResult.message);
        }
      } catch (error) {
        console.error('상품 등록 오류:', error);
        alert('상품 등록 중 오류가 발생했습니다.');
      }
    } else {
      alert('등록된 상품은 수정할 수 없습니다.');
    }
  };

  // 수정 버튼 클릭 (등록된 상품 탭)
  const handleEditProduct = () => {
    if (!selectedProduct) {
      alert('수정할 상품을 선택해주세요.');
      return;
    }
    
    setIsEditMode(true);
    setEditingProduct({ ...selectedProduct });
  };

  // ⭐ 수정 저장 개선 (등록된 상품 탭)
  const handleSaveEdit = async () => {
    if (!editingProduct || !editingProduct.id) {
      alert('수정할 상품 정보가 없습니다.');
      return;
    }

    try {
      const response = await fetchWithCors(`${API_BASE_URL}/products/registered/${editingProduct.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          product_name: editingProduct.product_name,
          category: editingProduct.category,
          description: editingProduct.description,
          price: editingProduct.price
        })
      });

      const result = await response.json();
      
      if (result.success) {
        alert('상품이 수정되었습니다.');
        
        await fetchRegisteredProducts();
        setIsEditMode(false);
        setEditingProduct(null);
        setSelectedProduct(editingProduct);
      } else {
        alert('상품 수정 실패: ' + result.message);
      }
    } catch (error) {
      console.error('상품 수정 오류:', error);
      alert('상품 수정 중 오류가 발생했습니다.');
    }
  };

  // ⭐ 삭제 버튼 클릭 개선 (소프트 삭제)
  const handleDeleteProduct = async () => {
    if (!selectedProduct || !selectedProduct.id) {
      alert('삭제할 상품을 선택해주세요.');
      return;
    }

    if (confirm('정말로 이 상품을 삭제하시겠습니까?')) {
      try {
        const response = await fetchWithCors(`${API_BASE_URL}/products/registered/${selectedProduct.id}`, {
          method: 'DELETE'
        });

        const result = await response.json();
        
        if (result.success) {
          alert('상품이 삭제되었습니다.');
          
          await fetchRegisteredProducts();
          setSelectedProduct(null);
          setSelectedRowIndex(null);
          setIsEditMode(false);
          setEditingProduct(null);
        } else {
          alert('상품 삭제 실패: ' + result.message);
        }
      } catch (error) {
        console.error('상품 삭제 오류:', error);
        alert('상품 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  // 초기화
  const handleResetForm = () => {
    if (activeTab === 'new' && selectedProduct) {
      setEditableFields({
        product_name: selectedProduct.product_name,
        category: selectedProduct.category,
        description: selectedProduct.description
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
  };

  // 현재 표시할 상품 정보 결정
  const getDisplayProduct = () => {
    if (activeTab === 'registered' && isEditMode && editingProduct) {
      return editingProduct;
    }
    return selectedProduct;
  };

  const displayProduct = getDisplayProduct();

  return (
    <div className="bg-white">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">상품 관리</h1>
      </div>

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
                    key={product.id || index}
                    onClick={() => handleProductClick(index)}
                    isSelected={selectedRowIndex === index}
                  >
                    <TableCell ellipsis={true} title={product.product_name}>
                      {product.product_name}
                    </TableCell>
                    <TableCell>{product.price}원</TableCell>
                    <TableCell>{product.product_code}</TableCell>
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

        {/* 우측 Card 영역 - 상품 상세 정보 */}
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
            {/* 상품명 */}
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
                if (activeTab === 'new') {
                  setEditableFields(prev => ({ ...prev, product_name: e.target.value }));
                } else if (isEditMode && editingProduct) {
                  setEditingProduct(prev => prev ? { ...prev, product_name: e.target.value } : null);
                }
              }}
            />

            {/* 가격 */}
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
                if (isEditMode && editingProduct) {
                  setEditingProduct(prev => prev ? { ...prev, price: e.target.value } : null);
                }
              }}
            />

            {/* 상품 링크 */}
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
                if (isEditMode && editingProduct) {
                  setEditingProduct(prev => prev ? { ...prev, product_url: e.target.value } : null);
                }
              }}
            />

            {/* 대표 이미지 */}
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
                  <div className="text-sm text-gray-600">
                    {displayProduct.main_image}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">
                  이미지를 선택해주세요 {activeTab === 'new' || !isEditMode ? '(편집 불가)' : ''}
                </div>
              )}
            </div>

            {/* 상품코드 */}
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

            {/* 상품 카테고리 */}
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
                    if (activeTab === 'new') {
                      setEditableFields(prev => ({ ...prev, category: e.target.value }));
                    } else if (isEditMode && editingProduct) {
                      setEditingProduct(prev => prev ? { ...prev, category: e.target.value } : null);
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

            {/* 상품설명 */}
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
                if (activeTab === 'new') {
                  setEditableFields(prev => ({ ...prev, description: e.target.value }));
                } else if (isEditMode && editingProduct) {
                  setEditingProduct(prev => prev ? { ...prev, description: e.target.value } : null);
                }
              }}
            />

            {/* 버튼 영역 */}
            <div className="flex gap-2 mt-8">
              {activeTab === 'new' ? (
                <>
                  <Button 
                    variant="save" 
                    onClick={handleSaveProduct}
                    disabled={!selectedProduct}
                  >
                    저장 후 등록
                  </Button>
                  <Button 
                    variant="reset" 
                    onClick={handleResetForm}
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
                        disabled={!editingProduct}
                      >
                        저장
                      </Button>
                      <Button 
                        variant="reset" 
                        onClick={handleResetForm}
                      >
                        취소
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button 
                        variant="edit" 
                        onClick={handleEditProduct}
                        disabled={!selectedProduct}
                      >
                        수정
                      </Button>
                      <Button 
                        variant="delete" 
                        onClick={handleDeleteProduct}
                        disabled={!selectedProduct}
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
