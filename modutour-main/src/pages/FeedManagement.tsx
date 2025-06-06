import React from 'react';
import { Copy } from 'lucide-react';
import { Card, StatCard } from '../components/ui/Card';
import Button from '../components/ui/Button';

const FeedManagement: React.FC = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">피드 관리</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="text-sm text-gray-500 mb-2">마지막 피드 생성 일시</div>
          <div className="text-xl font-semibold text-gray-900">2025-06-05 16:21</div>
        </Card>

        <StatCard title="피드 내 상품 수" value="23개" />

        <Card className="p-6">
          <div className="text-sm text-gray-500 mb-2">피드 URL</div>
          <div className="flex items-center gap-2 mt-3">
            <Copy className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-blue-600">https://modetour.name/ep.txt</span>
          </div>
        </Card>

        <Card className="p-6">
          <div className="text-sm text-gray-500 mb-4">수동으로 피드 생성하기</div>
          <Button>피드 생성하기</Button>
        </Card>
      </div>
    </div>
  );
};

export default FeedManagement;