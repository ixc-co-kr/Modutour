import React from 'react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import Button from '../components/ui/Button';

const CrawlingSettings: React.FC = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">크롤링 설정</h1>
      
      <Card className="p-6 max-w-5xl">
        <div className="space-y-6">
          <Input
            label="상품 관리 사용 제외 키워드 입력"
            placeholder="예) 직링크,실시"
            helpText="해당 필드에 입력된 키워드는 수집 후 상품 관리(상품목록 및 상품 정보)에서 자동 제외 처리 ('/'으로 관리)"
          />

          <Input
            label="수집 시 상품 코드 제외 관리"
            placeholder="예) NIL,EDG"
            helpText="해당 필드에 입력된 키워드는 상품 수집 시 자동 제외 처리 ('/'으로 관리)"
          />

          <Button>저장</Button>
        </div>
      </Card>
    </div>
  );
};

export default CrawlingSettings;
