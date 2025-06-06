import React, { useState } from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Card } from '../components/ui/Card';
import { Input, Textarea } from '../components/ui/Input';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import FileUpload from '../components/ui/FileUpload';
import Pagination from '../components/ui/Pagination';

const ShopManagement: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'new' | 'registered'>('new');

  // 더미 데이터
  const newProducts = [
    { name: '[신규] 제주도 한라산 트레킹 2박3일', price: '320,000', code: 'NEW001' },
    { name: '[신규] 부산 해운대 바다축제 1박2일', price: '180,000', code: 'NEW002' },
    { name: '[신규] 강릉 커피거리 투어 1박2일', price: '150,000', code: 'NEW003' },
  ];

  const registeredProducts = [
    { name: '[인천출발] 세부 자유여행 3박5일', price: '489,000', code: 'AVP636KE51' },
    { name: '[인천출발] 도쿄 도심투어 2박3일', price: '712,000', code: 'AVP636KE52' },
    { name: '[부산출발] 대만 야시장 투어 4박5일', price: '629,000', code: 'AVP636KE53' },
    { name: '[인천출발] 다낭 불꽃축제 자유 3박5일', price: '859,000', code: 'AVP636KE54' },
    { name: '[청주출발] 방콕 골프투어 3박5일', price: '1,120,000', code: 'AVP636KE55' },
    { name: '[김해출발] 오사카 쇼핑&온천 2박3일', price: '678,000', code: 'AVP636KE56' },
    { name: '[인천출발] 블라디보 여행 5박7일', price: '3,890,000', code: 'AVP636KE57' },
    { name: '[무안출발] 홍콩 나이트마켓 3박4일', price: '799,000', code: 'AVP636KE58' },
    { name: '[제주출발] 나트랑 용궁골프장 4박5일', price: '1,030,000', code: 'AVP636KE59' },
    { name: '[인천출발] 랍 PIC 리조트 4박5일', price: '1,420,000', code: 'AVP636KE60' },
    { name: '[김포출발] 상하이 디즈니 투어 2박3일', price: '988,000', code: 'AVP636KE61' },
    { name: '[인천출발] 파리+로마 유럽 여행 7일9일', price: '4,120,000', code: 'AVP636KE62' },
    { name: '[청주출발] 보라카이 럭셔리 리조트 3박5일', price: '5,390,000', code: 'AVP636KE63' },
    { name: '[인천출발] 싱가포르+말레이시아 투어', price: '1,240,000', code: 'AVP636KE64' },
    { name: '[김해출발] 사이판 마리아나 리조트 4박5일', price: '1,190,000', code: 'AVP636KE65' },
    { name: '[무안출발] 칸쿤 백사장 트레킹 3박4일', price: '1,090,000', code: 'AVP636KE66' },
    { name: '[인천출발] 푸꾸옥 바닷 리조트 자유 4박5일', price: '940,000', code: 'AVP636KE67' },
    { name: '[무안출발] 코타키나발루 투어 3박5일', price: '910,000', code: 'AVP636KE68' },
    { name: '[인천출발] 발리 우붓&스미냑 풀스파 5박7일', price: '2,280,000', code: 'AVP636KE69' },
  ];

  const currentProducts = activeTab === 'new' ? newProducts : registeredProducts;

  return (
    <div className="bg-white">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">상품 관리</h1>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('new')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'new' 
                ? 'text-blue-600 border-blue-600' 
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            신규 등록
          </button>
          <button
            onClick={() => setActiveTab('registered')}
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
        <Button>신규 상품 등록하기</Button>
        <div className="text-sm text-gray-500">최근 수집: 2025-06-05 16:10:24</div>
      </div>

      <div className="flex gap-8">
        <div className="flex-1 max-w-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>상품명</TableHead>
                <TableHead>가격</TableHead>
                <TableHead>상품코드</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentProducts.map((product, index) => (
                <TableRow key={index}>
                  <TableCell>{product.name}</TableCell>
                  <TableCell>{product.price}</TableCell>
                  <TableCell>{product.code}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination
            currentPage={currentPage}
            totalPages={activeTab === 'new' ? 1 : 5}
            onPageChange={setCurrentPage}
            className="mt-6"
          />
        </div>

        <Card className="w-[600px] p-6">
          <div className="space-y-6">
            <Input
              label="상품명"
              placeholder="인천출발 세부 자유여행 3박5일"
              helpText="100자 이내 / 추천검색 사용 금지 (형용사 등) / 정보성 텍스트 금지 (예: 직링크, 찬송가 등)"
            />

            <Input
              label="가격"
              placeholder="489,000"
            />

            <Input
              label="상품 링크"
              placeholder="https://tourmake.modetour.co.kr/Pkg/Itinerary/?PkgUrl=B7917693"
            />

            <FileUpload
              label="대표 이미지"
              fileName="filename.png"
            />

            <Input
              label="상품코드"
              placeholder="AVP636KE51"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">상품 카테고리</label>
              <div className="grid grid-cols-3 gap-2">
                <Select>
                  <option>여행/항공/여의</option>
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
              helpText="HTML 태그 불가 / 1000자 이내 권장"
            />

            <div className="flex gap-3">
              <Button className="flex-1">저장 후 등록</Button>
              <Button variant="outline" className="flex-1">초기화</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ShopManagement;
