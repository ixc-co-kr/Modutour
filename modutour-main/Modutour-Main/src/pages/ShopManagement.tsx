import React, { useState, useEffect } from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Card } from '../components/ui/Card';
import { Input, Textarea } from '../components/ui/Input';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import FileUpload from '../components/ui/FileUpload';
import Pagination from '../components/ui/Pagination';
import { productAPI } from '../services/api';

interface Product {
  id?: number;
  product_name: string;
  price: number;
  product_code: string;
  product_link?: string;
  main_image_url?: string;
  category?: string;
  description?: string;
  source_site?: string;
}

const ShopManagement: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'new' | 'registered'>('new');
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  
  // API 연동 상태
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // 폼 입력 상태 추가
  const [formData, setFormData] = useState({
    product_name: '',
    price: '',
    product_link: '',
    product_code: '',
    category: '',
    description: '',
    main_image_url: '',
    image_preview_url: ''
  });

  // 파일 업로드 핸들러 수정
  const handleFileUpload = (fileName: string, imageUrl?: string) => {
    setFormData(prev => ({
      ...prev,
      main_image_url: fileName,
      image_preview_url: imageUrl || ''
    }));
  };

  // 더미 데이터 (신규 상품용) - 상태로 관리
  const [newProducts, setNewProducts] = useState<Product[]>([
    { 
      product_name: '[신규] 제주도 한라산 트레킹 2박3일', 
      price: 320000, 
      product_code: 'NEW001',
      product_link: 'https://example.com/jeju-hiking',
      main_image_url: 'https://example.com/images/jeju.jpg',
      category: '국내여행',
      description: '제주도 한라산 트레킹 패키지',
      source_site: 'manual'
    },
    { 
      product_name: '[신규] 부산 해운대 바다축제 1박2일', 
      price: 180000, 
      product_code: 'NEW002',
      product_link: 'https://example.com/busan-festival',
      main_image_url: 'https://example.com/images/busan.jpg',
      category: '국내여행',
      description: '부산 해운대 바다축제 패키지',
      source_site: 'manual'
    },
    { 
      product_name: '[신규] 강릉 커피거리 투어 1박2일', 
      price: 150000, 
      product_code: 'NEW003',
      product_link: 'https://example.com/gangneung-coffee',
      main_image_url: 'https://example.com/images/gangneung.jpg',
      category: '국내여행',
      description: '강릉 커피거리 투어 패키지',
      source_site: 'manual'
    },
  ]);

  // 폼 입력 핸들러
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 저장 후 등록 버튼 핸들러 (실제 DB 저장 기능 추가)
  const handleSaveProduct = async () => {
    // 필수 필드 검증
    if (!formData.product_name || !formData.price || !formData.product_code) {
      alert('상품명, 가격, 상품코드는 필수 입력 항목입니다.');
      return;
    }

    try {
      setLoading(true);
      
      // 새 상품 객체 생성
      const newProduct = {
        product_name: formData.product_name,
        price: parseInt(formData.price.replace(/,/g, '')) || 0,
        product_code: formData.product_code,
        product_link: formData.product_link,
        main_image_url: formData.main_image_url,
        category: formData.category,
        description: formData.description
      };

      // 백엔드 API로 실제 저장
      const result = await productAPI.saveProduct(newProduct);
      
      if (result.success) {
        // 저장 성공 시 로컬 상태도 업데이트
        const savedProduct = { ...newProduct, id: result.product_id, source_site: 'manual' };
        
        if (activeTab === 'new') {
          setNewProducts(prev => [...prev, savedProduct]);
        } else {
          setProducts(prev => [...prev, savedProduct]);
          // 등록된 상품 탭에서는 서버에서 최신 데이터 다시 가져오기
          await fetchProducts();
        }
        
        handleResetForm();
        alert('상품이 데이터베이스에 성공적으로 저장되었습니다!');
      }
      
    } catch (error: any) {
      console.error('저장 오류:', error);
      
      // 백엔드 연결 실패 시 로컬 상태에만 저장 (임시)
      const newProduct: Product = {
        product_name: formData.product_name,
        price: parseInt(formData.price.replace(/,/g, '')) || 0,
        product_code: formData.product_code,
        product_link: formData.product_link,
        main_image_url: formData.main_image_url,
        category: formData.category,
        description: formData.description,
        source_site: 'manual'
      };

      if (activeTab === 'new') {
        setNewProducts(prev => [...prev, newProduct]);
      } else {
        setProducts(prev => [...prev, newProduct]);
      }
      
      handleResetForm();
      alert(`백엔드 연결 실패로 로컬에만 저장되었습니다.\n오류: ${error.message || '알 수 없는 오류'}`);
    } finally {
      setLoading(false);
    }
  };

  // 초기화 버튼 핸들러
  const handleResetForm = () => {
    setFormData({
      product_name: '',
      price: '',
      product_link: '',
      product_code: '',
      category: '',
      description: '',
      main_image_url: '',
      image_preview_url: ''
    });
    setSelectedRowIndex(null);
  };

  // 백엔드에서 상품 데이터 가져오기 (제외 키워드 필터링 추가)
  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 제외 설정 조회
      const excludeResponse = await fetch('http://localhost:5001/api/exclude-settings');
      const excludeData = await excludeResponse.json();
      
      let excludeKeywords: string[] = [];
      if (excludeData.success && excludeData.settings && excludeData.settings.exclude_keywords) {
        excludeKeywords = excludeData.settings.exclude_keywords.split(',').map((k: string) => k.trim());
      }
      
      // 상품 데이터 조회
      const data = await productAPI.getProducts(currentPage, '');
      let filteredProducts = data.products || [];
      
      // 제외 키워드 필터링 (프론트엔드에서 추가 필터링)
      if (excludeKeywords.length > 0) {
        filteredProducts = filteredProducts.filter((product: Product) => {
          const productName = product.product_name.toLowerCase();
          return !excludeKeywords.some(keyword => 
            productName.includes(keyword.toLowerCase())
          );
        });
      }
      
      setProducts(filteredProducts);
      setLastUpdated(new Date().toLocaleString('ko-KR'));
    } catch (error) {
      console.error('상품 로딩 실패:', error);
      setError('상품 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 신규 상품 크롤링 실행
  const handleNewProductCrawling = async () => {
    try {
      setLoading(true);
      await productAPI.triggerCrawling();
      await fetchProducts();
      alert('신규 상품을 성공적으로 불러왔습니다.');
    } catch (error) {
      console.error('크롤링 실패:', error);
      alert('신규 상품 불러오기에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 컴포넌트 마운트 시 백엔드 연결 테스트 및 데이터 로드
  useEffect(() => {
    const initializeComponent = async () => {
      try {
        // 백엔드 연결 테스트
        await productAPI.healthCheck();
        console.log('백엔드 서버 연결 성공');
        
        // 등록된 상품 탭일 때 데이터 로드
        if (activeTab === 'registered') {
          await fetchProducts();
        }
      } catch (error) {
        console.error('백엔드 서버 연결 실패:', error);
        setError('백엔드 서버에 연결할 수 없습니다. 로컬 데이터만 사용됩니다.');
      }
    };

    initializeComponent();
  }, [activeTab, currentPage]);

  // 현재 표시할 상품 데이터 결정 (신규 등록 탭에도 제외 키워드 적용)
  const getCurrentProducts = async () => {
    let currentProducts = activeTab === 'new' ? newProducts : products;
    
    // 신규 등록 탭에도 제외 키워드 적용
    if (activeTab === 'new') {
      try {
        const excludeResponse = await fetch('http://localhost:5001/api/exclude-settings');
        const excludeData = await excludeResponse.json();
        
        if (excludeData.success && excludeData.settings && excludeData.settings.exclude_keywords) {
          const excludeKeywords = excludeData.settings.exclude_keywords.split(',').map((k: string) => k.trim());
          
          if (excludeKeywords.length > 0) {
            currentProducts = currentProducts.filter((product: Product) => {
              const productName = product.product_name.toLowerCase();
              return !excludeKeywords.some(keyword => 
                productName.includes(keyword.toLowerCase())
              );
            });
          }
        }
      } catch (error) {
        console.error('제외 설정 조회 실패:', error);
      }
    }
    
    return currentProducts;
  };

  // 필터링된 상품 목록을 위한 상태
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

  // 탭 변경 또는 데이터 변경 시 필터링된 상품 목록 업데이트
  useEffect(() => {
    const updateFilteredProducts = async () => {
      const filtered = await getCurrentProducts();
      setFilteredProducts(filtered);
    };
    
    updateFilteredProducts();
  }, [activeTab, newProducts, products]);

  // 탭 변경 시 선택된 행 및 폼 초기화
  const handleTabChange = (tab: 'new' | 'registered') => {
    setActiveTab(tab);
    setSelectedRowIndex(null);
    setCurrentPage(1);
    handleResetForm();
  };

  // 행 선택 시 폼에 데이터 로드
  const handleRowSelect = (index: number) => {
    setSelectedRowIndex(index);
    const selectedProduct = filteredProducts[index];
    
    setFormData({
      product_name: selectedProduct.product_name,
      price: selectedProduct.price.toString(),
      product_link: selectedProduct.product_link || '',
      product_code: selectedProduct.product_code,
      category: selectedProduct.category || '',
      description: selectedProduct.description || '',
      main_image_url: selectedProduct.main_image_url || '',
      image_preview_url: selectedProduct.main_image_url || ''
    });
  };

  // 가격 포맷팅 함수
  const formatPrice = (price: number) => {
    return price.toLocaleString('ko-KR');
  };

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
            신규 등록
          </button>
          <button
            onClick={() => handleTabChange('registered')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'registered' 
                ? 'text-blue-600 border-blue-600' 
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            등록된 상품
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="new-product"
          onClick={handleNewProductCrawling}
          disabled={loading}
        >
          {loading ? '불러오는 중...' : '신규 상품 불러오기'}
        </Button>
        <div className="text-sm text-gray-500">
          최근 수집: {lastUpdated || '2025-06-05 16:10:24'}
        </div>
      </div>

      {/* 에러 메시지 표시 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

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
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8">
                    데이터를 불러오는 중...
                  </TableCell>
                </TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8">
                    상품이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product, index) => (
                  <TableRow 
                    key={product.product_code || index}
                    onClick={() => handleRowSelect(index)}
                    isSelected={selectedRowIndex === index}
                  >
                    <TableCell>{product.product_name}</TableCell>
                    <TableCell>{formatPrice(product.price)}</TableCell>
                    <TableCell>{product.product_code}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <Pagination
            currentPage={currentPage}
            totalPages={activeTab === 'new' ? 1 : 5}
            onPageChange={setCurrentPage}
            className="mt-6"
          />
        </div>

        {/* 우측 Card 영역 - 입력 폼 */}
        <div 
          className="bg-white border border-gray-200"
          style={{
            width: '943px',
            height: '800px',
            top: '194px',
            left: '633px',
            gap: '10px',
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
              placeholder="인천출발 세부 자유여행 3박5일"
              value={formData.product_name}
              onChange={(e) => handleInputChange('product_name', e.target.value)}
              helpText="100자 이내 / 특수문자 사용 금지 (!,@,# 등) / 광고성 표현 금지 (예: 최저가, 단하루 등)"
              variant="product-name"
            />

            <Input
              label="가격"
              placeholder="489,000"
              value={formData.price}
              onChange={(e) => handleInputChange('price', e.target.value)}
              variant="price"
            />

            <Input
              label="상품 링크"
              placeholder="https://tourmake.modetour.co.kr/Pkg/Itinerary/?PkgUrl=B7917693"
              value={formData.product_link}
              onChange={(e) => handleInputChange('product_link', e.target.value)}
              variant="product-link"
            />

            <FileUpload
              label="대표 이미지"
              fileName={formData.main_image_url}
              onUpload={handleFileUpload}
            />

            <Input
              label="상품코드"
              placeholder="AVP636KE51"
              value={formData.product_code}
              onChange={(e) => handleInputChange('product_code', e.target.value)}
              variant="product-code"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">상품 카테고리</label>
              <div className="grid grid-cols-3 gap-2">
                <Select 
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                >
                  <option value="">선택하세요</option>
                  <option value="국내여행">국내여행</option>
                  <option value="해외여행">해외여행</option>
                  <option value="호텔">호텔</option>
                </Select>
                <Select>
                  <option>해외여행</option>
                </Select>
                <Select>
                  <option>항해여행지/기타</option>
                </Select>
              </div>
            </div>

            <Textarea
              label="상품설명"
              placeholder="#2도시여행 #벤트펍달링 #푸켓발견김과 #피피섬어장"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              helpText="HTML 태그 불가 / 1000자 이내 권장"
              variant="product-description"
            />

            <div className="flex gap-2 mt-8">
              <Button 
                variant={activeTab === 'registered' ? 'edit' : 'save'}
                onClick={handleSaveProduct}
                disabled={loading}
              >
                {loading ? '저장 중...' : (activeTab === 'registered' ? '수정' : '저장 후 등록')}
              </Button>
              <Button 
                variant={activeTab === 'registered' ? 'delete' : 'reset'}
                onClick={handleResetForm}
              >
                {activeTab === 'registered' ? '삭제' : '초기화'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopManagement;
