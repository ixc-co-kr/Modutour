import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  helpText?: string;
  required?: boolean;
}

const PasswordInput: React.FC<PasswordInputProps> = ({
  label,
  placeholder,
  value,
  onChange,
  className = '',
  helpText,
  required = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  // 입력 필드 스타일 (product-link variant와 동일)
  const inputStyle = {
    width: '895px',
    height: '32px',
    gap: '10px',
    borderRadius: '6px',
    borderWidth: '1px',
    paddingRight: '12px',
    paddingLeft: '12px',
    fontFamily: 'Pretendard',
    fontWeight: 400,
    fontSize: '14px',
    lineHeight: '22px',
    letterSpacing: '0%'
  };

  // label 스타일
  const labelStyle = {
    fontFamily: 'Pretendard',
    fontWeight: 400,
    fontSize: '14px',
    lineHeight: '22px',
    letterSpacing: '0%',
    color: '#000000E0'
  };

  // helpText 스타일
  const helpTextStyle = {
    fontFamily: 'Pretendard',
    fontWeight: 400,
    fontSize: '14px',
    lineHeight: '22px',
    letterSpacing: '0%'
  };

  return (
    <div className="space-y-1">
      {label && (
        <label className="block" style={labelStyle}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className={`px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10 ${className}`}
          style={inputStyle}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {showPassword ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </button>
      </div>
      {helpText && (
        <div className="text-gray-500" style={helpTextStyle}>
          {helpText}
        </div>
      )}
    </div>
  );
};

export default PasswordInput;
