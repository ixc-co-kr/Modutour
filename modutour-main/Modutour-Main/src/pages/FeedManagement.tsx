import React, { useState, useEffect } from 'react';
import { CopyOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Typography, message } from 'antd';
import { Card } from '../components/ui/Card';

const { Text } = Typography;

interface FeedStats {
  totalRegistered: number;
  todayNewCount: number;
  lastEpTime: string;
  epProductCount: number;
  epUrl: string;
}

const FeedManagement: React.FC = () => {
  const [stats, setStats] = useState<FeedStats>({
    totalRegistered: 0,
    todayNewCount: 0,
    lastEpTime: '생성된 피드 없음',
    epProductCount: 0,
    epUrl: ''
  });
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // ⭐ URL 텍스트 자르기 함수
  const truncateUrl = (url: string, maxLength: number = 20) => {
    if (!url) return '생성된 피드 없음';
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  };

  // 피드 관리 통계 조회
  const fetchFeedStats = async () => {
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
        const safeData = {
          totalRegistered: result.data.totalRegistered || 0,
          todayNewCount: result.data.todayNewCount || 0,
          lastEpTime: result.data.lastEpTime || '생성된 피드 없음',
          epProductCount: result.data.epProductCount || 0,
          epUrl: result.data.epUrl || ''
        };
        
        setStats(safeData);
        console.log('피드 관리 통계 로딩 완료:', safeData);
      } else {
        throw new Error(result.message || '통계 조회 실패');
      }
    } catch (error) {
      console.error('피드 관리 통계 조회 오류:', error);
      message.error('통계 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 컴포넌트 마운트 시 통계 조회
  useEffect(() => {
    fetchFeedStats();
  }, []);

  // URL 복사 함수
  const handleCopyUrl = async () => {
    try {
      if (!stats.epUrl) {
        message.warning('생성된 피드가 없습니다.');
        return;
      }
      
      await navigator.clipboard.writeText(stats.epUrl);
      message.success('피드 URL이 클립보드에 복사되었습니다.');
    } catch (error) {
      console.error('URL 복사 실패:', error);
      message.error('URL 복사에 실패했습니다.');
    }
  };

  // 피드 생성 함수
  const handleGenerateFeed = async () => {
    try {
      setGenerating(true);
      
      const response = await fetch('http://localhost:5001/api/feed/generate', {
        method: 'POST',
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
      
      if (result.success) {
        message.success(result.message);
        // 피드 생성 후 통계 새로고침
        await fetchFeedStats();
      } else {
        throw new Error(result.message || '피드 생성 실패');
      }
    } catch (error) {
      console.error('피드 생성 오류:', error);
      message.error('피드 생성에 실패했습니다.');
    } finally {
      setGenerating(false);
    }
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

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">피드 관리</h1>
        <Button 
          icon={<ReloadOutlined />} 
          onClick={fetchFeedStats}
          loading={loading}
        >
          새로고침
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            피드 내 상품 수
          </Text>
          <div style={valueStyle}>
            {loading ? '로딩중...' : `${(stats?.epProductCount ?? 0).toLocaleString()}개`}
          </div>
        </Card>
        
        {/* ⭐ 피드 URL 카드 - 말줄임표 처리 적용 */}
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
              title={stats.epUrl || '생성된 피드 없음'} // 전체 URL을 툴팁으로 표시
              style={{
                width: '241px',
                height: '38px',
                gap: '8px',
                borderRadius: '6px',
                borderWidth: '1px',
                border: '1px solid #00000026',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                padding: '0 12px',
                textAlign: 'left' as const
              }}
            >
              <span style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap' as const,
                marginLeft: '8px',
                fontSize: '13px'
              }}>
                {truncateUrl(stats.epUrl, 30)}
              </span>
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <Text type="secondary" style={labelStyle} className="block mb-2">
            수동으로 피드 생성하기
          </Text>
          <div className="mt-3">
            <Button 
              type="primary"
              onClick={handleGenerateFeed}
              loading={generating}
              style={{
                width: '109px',
                height: '38px',
                gap: '8px',
                borderRadius: '6px',
                borderWidth: '1px',
                paddingRight: '16px',
                paddingLeft: '16px',
                background: '#1677FF',
                border: '1px solid #1677FF',
                fontFamily: 'Pretendard',
                fontWeight: 400,
                fontSize: '14px',
                lineHeight: '22px',
                letterSpacing: '0%'
              }}
            >
              피드 생성하기
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default FeedManagement;
