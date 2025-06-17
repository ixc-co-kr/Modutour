import React, { useState, useEffect } from 'react';
import { CopyOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Typography, message } from 'antd';
import { Card } from '../components/ui/Card';

const { Text } = Typography;

interface DashboardStats {
  totalRegistered: number;
  todayNewCount: number;
  lastEpTime: string;
  epUrl: string;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalRegistered: 0,
    todayNewCount: 0,
    lastEpTime: '2025-06-17 11:35',
    epUrl: ''
  });
  const [loading, setLoading] = useState(false);

  // ⭐ 대시보드 통계 조회
  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('http://localhost:5001/api/dashboard/stats', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        mode: 'cors'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        setStats(result.data);
        console.log('대시보드 통계 로딩 완료:', result.data);
      } else {
        throw new Error(result.message || '통계 조회 실패');
      }
    } catch (error) {
      console.error('대시보드 통계 조회 오류:', error);
      message.error('통계 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ⭐ 컴포넌트 마운트 시 통계 조회
  useEffect(() => {
    fetchDashboardStats();
    
    // 5분마다 자동 새로고침
    const interval = setInterval(fetchDashboardStats, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  // ⭐ URL 복사 함수
  const handleCopyUrl = async () => {
    try {
      if (!stats.epUrl) {
        message.warning('아직 생성된 피드 파일이 없습니다.');
        return;
      }
      
      await navigator.clipboard.writeText(stats.epUrl);
      message.success('피드 URL이 클립보드에 복사되었습니다.');
    } catch (error) {
      console.error('URL 복사 실패:', error);
      message.error('URL 복사에 실패했습니다.');
    }
  };

  // ⭐ 수동 새로고침
  const handleRefresh = () => {
    fetchDashboardStats();
  };

  const labelStyle = {
    fontSize: '14px',
    color: '#00000073'
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

  // ⭐ URL 버튼 스타일 (말줄임표 적용)
  const urlButtonStyle = {
    width: '100%',
    height: '38px',
    borderRadius: '6px',
    borderWidth: '1px',
    border: '1px solid #00000026',
    textAlign: 'left' as const,
    padding: '0 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start'
  };

  const urlTextStyle = {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    marginLeft: '8px',
    fontSize: '13px'
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <Button 
          icon={<ReloadOutlined />} 
          onClick={handleRefresh}
          loading={loading}
        >
          새로고침
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <Text type="secondary" style={labelStyle} className="block mb-2">
            총 등록 상품 수
          </Text>
          <div style={valueStyle}>
            {loading ? '로딩중...' : `${stats.totalRegistered.toLocaleString()}개`}
          </div>
        </Card>

        <Card className="p-6">
          <Text type="secondary" style={labelStyle} className="block mb-2">
            오늘 신규 수집 수
          </Text>
          <div style={valueStyle}>
            {loading ? '로딩중...' : `${stats.todayNewCount.toLocaleString()}개`}
          </div>
        </Card>
        
        <Card className="p-6">
          <Text type="secondary" style={labelStyle} className="block mb-2">
            마지막 피드 생성 일시
          </Text>
          <div style={valueStyle}>
            {loading ? '로딩중...' : stats.lastEpTime}
          </div>
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
              disabled={loading || !stats.epUrl}
              title={stats.epUrl || '피드 파일이 생성되지 않았습니다'}
              style={urlButtonStyle}
            >
              <span style={urlTextStyle}>
                {stats.epUrl || '피드 파일이 생성되지 않았습니다'}
              </span>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
