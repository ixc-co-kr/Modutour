// src/components/NaverEPManager.tsx
import React, { useState, useEffect } from 'react';
import Button from './ui/Button';

interface EPFile {
  fileName: string;
  url: string;
  createdAt: string;
  size: number;
}

interface EPStatus {
  totalProducts: number;
  epFiles: EPFile[];
  latestEP: EPFile | null;
}

const NaverEPManager: React.FC = () => {
  const [epStatus, setEpStatus] = useState<EPStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // loadEPStatus 함수 내부 수정
  const loadEPStatus = async () => {
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
    
    const result = await response.json();
    
    if (result.success) {
      // ⭐ 서버 응답을 기존 구조에 맞게 변환
      const mappedData: EPStatus = {
        totalProducts: result.data.totalRegistered,
        epFiles: result.data.epUrl ? [{
          fileName: 'ep.txt',
          url: result.data.epUrl,
          createdAt: result.data.lastEpTime,
          size: result.data.epProductCount * 100 // 대략적인 크기 계산
        }] : [],
        latestEP: result.data.epUrl ? {
          fileName: 'ep.txt',
          url: result.data.epUrl,
          createdAt: result.data.lastEpTime,
          size: result.data.epProductCount * 100
        } : null
      };
      
      setEpStatus(mappedData);
    }
  } catch (error) {
    console.error('EP 상태 조회 실패:', error);
  } finally {
    setLoading(false);
  }
};


  // generateEP 함수 수정
const generateEP = async () => {
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

    const result = await response.json();
    
    if (result.success) {
      alert(`피드 생성 완료!\n\n${result.message}\n\nEP URL: ${result.data.epUrl}`);
      await loadEPStatus();
    } else {
      alert(`피드 생성 실패: ${result.message}`);
    }
  } catch (error) {
    console.error('피드 생성 실패:', error);
    alert('피드 생성 중 오류가 발생했습니다.');
  } finally {
    setGenerating(false);
  }
};


  // URL 복사 함수
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('URL이 클립보드에 복사되었습니다.');
    } catch (error) {
      console.error('클립보드 복사 실패:', error);
      alert('클립보드 복사에 실패했습니다.');
    }
  };

  // 파일 크기 포맷팅
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  useEffect(() => {
    loadEPStatus();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">네이버 EP 관리</h2>
          <p className="text-sm text-gray-600 mt-1">
            등록된 상품을 네이버 가격비교 EP 형식으로 생성합니다
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={loadEPStatus}
            variant="outline"
            disabled={loading}
          >
            새로고침
          </Button>
          <Button
            onClick={generateEP}
            variant="save"
            disabled={generating || loading}
          >
            {generating ? 'EP 생성 중...' : 'EP 생성'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="text-gray-600">EP 상태를 확인하는 중...</div>
        </div>
      ) : epStatus ? (
        <div className="space-y-6">
          {/* 현재 상태 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-blue-600">등록된 상품</div>
              <div className="text-2xl font-bold text-blue-900">
                {epStatus.totalProducts.toLocaleString()}개
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-green-600">생성된 EP 파일</div>
              <div className="text-2xl font-bold text-green-900">
                {epStatus.epFiles.length}개
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-purple-600">최신 EP</div>
              <div className="text-sm font-bold text-purple-900">
                {epStatus.latestEP 
                  ? new Date(epStatus.latestEP.createdAt).toLocaleString('ko-KR')
                  : '없음'
                }
              </div>
            </div>
          </div>

          {/* 최신 EP 정보 */}
          {epStatus.latestEP && (
            <div className="border border-green-200 bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-800 mb-2">📄 최신 EP 파일</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">파일명:</span> {epStatus.latestEP.fileName}
                </div>
                <div>
                  <span className="font-medium">크기:</span> {formatFileSize(epStatus.latestEP.size)}
                </div>
                <div>
                  <span className="font-medium">생성일:</span> {new Date(epStatus.latestEP.createdAt).toLocaleString('ko-KR')}
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium">EP URL:</span>
                  <a
                    href={epStatus.latestEP.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline break-all"
                  >
                    {epStatus.latestEP.url}
                  </a>
                  {/* ⭐ size prop 제거 */}
                  <Button
                    onClick={() => copyToClipboard(epStatus.latestEP!.url)}
                    variant="outline"
                  >
                    복사
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* EP 파일 목록 */}
          {epStatus.epFiles.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">📁 EP 파일 목록</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        파일명
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        크기
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        생성일
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        액션
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {epStatus.epFiles.map((file, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {file.fileName}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {formatFileSize(file.size)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(file.createdAt).toLocaleString('ko-KR')}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-900"
                          >
                            다운로드
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 사용 안내 */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-2">📋 네이버 가격비교 등록 방법</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
              <li>네이버 쇼핑파트너센터에 로그인</li>
              <li>[상품관리] → [상품정보 수신 현황] 메뉴 이동</li>
              <li>"등록요청" 버튼 클릭</li>
              <li>위의 EP URL을 "상품 DB URL" 필드에 입력</li>
              <li>심사 완료 후 1-2일 내 네이버 가격비교에 상품 노출</li>
            </ol>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="text-gray-500">EP 상태 정보를 불러올 수 없습니다.</div>
        </div>
      )}
    </div>
  );
};

export default NaverEPManager;
