import React from 'react';
import { CopyOutlined } from '@ant-design/icons';
import { Button, Typography } from 'antd';
import { Card, StatCard } from '../components/ui/Card';

const { Text } = Typography;

const Dashboard: React.FC = () => {
  const handleCopyUrl = () => {
    const url = 'https://modetour.name/ep.txt';
    navigator.clipboard.writeText(url).then(() => {
      console.log('URL copied to clipboard');
      // 필요시 성공 메시지 표시
    });
  };

  const labelStyle = {
    fontSize: '14px', // SM size
    color: '#00000073' // secondary color
  };

  const valueStyle = {
    fontFamily: 'Pretendard',
    fontWeight: 600,
    fontSize: '30px',
    lineHeight: '38px',
    letterSpacing: '0%',
    verticalAlign: 'middle',
    color: '#000000E0'
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">대시보드</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <Text type="secondary" style={labelStyle} className="block mb-2">
            총 등록 상품 수
          </Text>
          <div style={valueStyle}>1,482개</div>
        </Card>

        <Card className="p-6">
          <Text type="secondary" style={labelStyle} className="block mb-2">
            오늘 신규 수집 수
          </Text>
          <div style={valueStyle}>23개</div>
        </Card>
        
        <Card className="p-6">
          <Text type="secondary" style={labelStyle} className="block mb-2">
            마지막 피드 생성 일시
          </Text>
          <div style={valueStyle}>2025-06-05 16:21</div>
        </Card>

        <Card className="p-6">
          <Text type="secondary" style={labelStyle} className="block mb-2">
            피드 URL
          </Text>
          <div className="mt-3">
            <Button 
              type="default"
              icon={<CopyOutlined />}
              onClick={handleCopyUrl}
              style={{
                width: '241px',
                height: '38px',
                gap: '8px',
                borderRadius: '6px',
                borderWidth: '1px',
                border: '1px solid #00000026'
              }}
            >
              https://modetour.name/ep.txt
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
