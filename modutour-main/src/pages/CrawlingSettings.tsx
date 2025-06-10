import React from 'react';
import { Button } from 'antd';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';

const CrawlingSettings: React.FC = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">크롤링 설정</h1>
      
      <div 
        className="bg-white border border-gray-200"
        style={{
          width: '943px',
          height: '292px',
          top: '84px',
          left: '24px',
          gap: '10px',
          borderRadius: '6px',
          borderWidth: '1px',
          paddingTop: '16px',    // padding
          paddingRight: '32px',  // paddingLG
          paddingBottom: '16px', // padding
          paddingLeft: '32px',   // paddingLG
        }}
      >
        <div className="space-y-6">
          <Input
            label="상품 관리 자동 제외 키워드 입력"
            placeholder="예) 최저가,임시"
            helpText="해당 필드에 입력된 키워드는 수집 후 상품 관리(상품목록 및 상품 설명)에서 자동 제외 처리 (','으로 관리)"
            variant="product-link"
          />

          <Input
            label="수집 시 상품 코드 제외 관리"
            placeholder="예) LIL,EDG"
            helpText="해당 필드에 입력된 키워드는 상품 수집 시 자동 제외 처리 (','으로 관리)"
            variant="product-link"
          />

          <Button 
            type="primary"
            style={{
              width: '57px',
              height: '32px',
              gap: '8px',
              borderRadius: '6px',
              borderWidth: '1px',
              paddingRight: '16px',
              paddingLeft: '16px',
              background: '#1677FF',
              border: '1px solid #1677FF'
            }}
          >
            저장
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CrawlingSettings;
