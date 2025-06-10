import React, { useState, useEffect } from 'react';
import { Button } from 'antd';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';

const CrawlingSettings: React.FC = () => {
  // 제외 키워드 설정 상태
  const [excludeKeywords, setExcludeKeywords] = useState('');
  const [excludeProductCodes, setExcludeProductCodes] = useState('');
  const [loading, setLoading] = useState(false);

  // 컴포넌트 마운트 시 기존 설정 로드
  useEffect(() => {
    loadExcludeSettings();
  }, []);

  const loadExcludeSettings = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/exclude-settings');
      const data = await response.json();
      
      if (data.success && data.settings) {
        setExcludeKeywords(data.settings.exclude_keywords || '');
        setExcludeProductCodes(data.settings.exclude_product_codes || '');
      }
    } catch (error) {
      console.error('제외 설정 로드 실패:', error);
    }
  };

  const saveExcludeSettings = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('http://localhost:5001/api/exclude-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exclude_keywords: excludeKeywords,
          exclude_product_codes: excludeProductCodes
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('제외 키워드 설정이 저장되었습니다.');
      } else {
        alert('저장 실패: ' + data.error);
      }
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

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
            value={excludeKeywords}
            onChange={(e) => setExcludeKeywords(e.target.value)}
            helpText="해당 필드에 입력된 키워드는 수집 후 상품 관리(상품목록 및 상품 설명)에서 자동 제외 처리 (','으로 관리)"
            variant="product-link"
          />

          <Input
            label="수집 시 상품 코드 제외 관리"
            placeholder="예) LIL,EDG"
            value={excludeProductCodes}
            onChange={(e) => setExcludeProductCodes(e.target.value)}
            helpText="해당 필드에 입력된 키워드는 상품 수집 시 자동 제외 처리 (','으로 관리)"
            variant="product-link"
          />

          <Button 
            type="primary"
            onClick={saveExcludeSettings}
            disabled={loading}
            style={{
              width: '57px',
              height: '32px',
              gap: '8px',
              borderRadius: '6px',
              borderWidth: '1px',
              paddingRight: '16px',
              paddingLeft: '16px',
              background: loading ? '#d9d9d9' : '#1677FF',
              border: loading ? '1px solid #d9d9d9' : '1px solid #1677FF'
            }}
          >
            {loading ? '저장중' : '저장'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CrawlingSettings;
