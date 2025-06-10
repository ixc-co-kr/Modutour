import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Login attempted with:', { email, password });
    
    // 나중에 서버 연결 시 실제 유효성 검사로 대체될 부분
    // 현재는 이메일과 패스워드가 입력되어 있으면 로그인 성공으로 처리
    if (email && password) {
      onLogin(); // 이 함수가 호출되면 App.tsx에서 isLoggedIn을 true로 설정하여 대시보드로 이동
    } else {
      // 입력값이 없을 경우 알림 (선택사항)
      alert('이메일과 비밀번호를 입력해주세요.');
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
    backgroundColor: '#1677FF',
    color: '#FFFFFF',
    fontFamily: 'Pretendard',
    fontWeight: 400,
    fontSize: '16px',
    lineHeight: '24px',
    letterSpacing: '0%',
    boxShadow: '0px 2px 0px 0px #00000005',
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
              {/* Email Field */}
              <div className="flex-1">
                <label 
                  htmlFor="email" 
                  className="block font-medium mb-1"
                  style={labelStyle}
                >
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                  placeholder=""
                  required
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
                    placeholder=""
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
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

            {/* Login Button */}
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md transition-all duration-200"
              style={{ 
                width: '324px',
                marginTop: '25px',
                ...buttonStyle
              }}
            >
              로그인
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
