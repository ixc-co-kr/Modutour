import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // ⭐ 관리자 계정 정보
  const ADMIN_CREDENTIALS = {
    id: 'padi123',
    password: 'Dldudxo!@1161'
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); // 에러 메시지 초기화
    setIsLoading(true);
    
    console.log('Login attempted with:', { email, password });
    
    // 로딩 시뮬레이션 (UX 개선)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // ⭐ 설정된 ID/PW와 정확히 일치하는지 확인
    if (email === ADMIN_CREDENTIALS.id && password === ADMIN_CREDENTIALS.password) {
      // 로그인 성공
      console.log('로그인 성공');
      
      // 세션 스토리지에 로그인 상태 저장
      sessionStorage.setItem('isAuthenticated', 'true');
      sessionStorage.setItem('loginTime', new Date().toISOString());
      sessionStorage.setItem('userId', email);
      
      setIsLoading(false);
      onLogin(); // 대시보드로 이동
    } else {
      // 로그인 실패
      console.log('로그인 실패');
      setIsLoading(false);
      
      if (!email || !password) {
        setError('아이디와 비밀번호를 모두 입력해주세요.');
      } else {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.');
      }
      
      // 비밀번호 필드 초기화 (보안)
      setPassword('');
    }
  };

  // 라벨 텍스트 스타일
  const labelStyle = {
    fontFamily: 'Pretendard',
    fontWeight: 400,
    fontSize: '14px',
    lineHeight: '22px',
    letterSpacing: '0%',
    background: '#FFFFFF',
    color: '#000000E0'
  };

  // 로그인 버튼 스타일
  const buttonStyle = {
    backgroundColor: isLoading ? '#91CAFF' : '#1677FF',
    color: '#FFFFFF',
    fontFamily: 'Pretendard',
    fontWeight: 400,
    fontSize: '16px',
    lineHeight: '24px',
    letterSpacing: '0%',
    boxShadow: '0px 2px 0px 0px #00000005',
    cursor: isLoading ? 'not-allowed' : 'pointer'
  };

  // 에러 메시지 스타일
  const errorStyle = {
    fontFamily: 'Pretendard',
    fontWeight: 400,
    fontSize: '14px',
    lineHeight: '22px',
    color: '#FF4D4F',
    marginTop: '8px',
    textAlign: 'center' as const
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div 
        className="bg-white shadow-sm border"
        style={{ 
          width: '420px', 
          height: '402px', 
          padding: '48px', 
          gap: '24px',
          borderRadius: '8px',
          borderWidth: '1px'
        }}
      >
        <div className="flex flex-col h-full" style={{ gap: '24px' }}>
          {/* Logo */}
          <div>
            <div className="mb-6">
              <img 
                src="/Modutour_logo.png" 
                alt="모두투어" 
                style={{ 
                  width: '113px', 
                  height: '22px',
                  display: 'block'
                }}
              />
            </div>
            <h4 className="text-lg font-medium text-gray-900 m-0">
              로그인이 필요합니다.
            </h4>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between">
            {/* Form Container with specified dimensions */}
            <div style={{ width: '324px', height: '144px', gap: '12px' }} className="flex flex-col">
              {/* ID Field */}
              <div className="flex-1">
                <label 
                  htmlFor="email" 
                  className="block font-medium mb-1"
                  style={labelStyle}
                >
                  ID
                </label>
                <input
                  type="text"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                  placeholder="아이디를 입력하세요"
                  required
                  disabled={isLoading}
                  autoComplete="username"
                />
              </div>

              {/* Password Field */}
              <div className="flex-1">
                <label 
                  htmlFor="password" 
                  className="block font-medium mb-1"
                  style={labelStyle}
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                    placeholder="비밀번호를 입력하세요"
                    required
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* ⭐ 에러 메시지 표시 */}
            {error && (
              <div style={errorStyle}>
                {error}
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ 
                width: '324px',
                marginTop: error ? '12px' : '25px',
                ...buttonStyle
              }}
            >
              {isLoading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
