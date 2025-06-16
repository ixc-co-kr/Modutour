import { floatButtonPrefixCls } from 'antd/es/float-button/FloatButton';
import React from 'react';

interface InputProps {
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  label?: string;
  helpText?: string;
  disabled?: boolean; // 이미 있음
  required?: boolean;
  variant?: 'default' | 'product-name' | 'price' | 'product-link' | 'product-code' | 'category-1' | 'category-2' | 'category-3';
}

const Input: React.FC<InputProps> = ({
  type = 'text',
  placeholder,
  value,
  onChange,
  className = '',
  label,
  helpText,
  disabled = false,
  required = false,
  variant = 'default'
}) => {
  // 각 variant별 스타일 정의
  const getVariantStyle = () => {
    switch (variant) {
      case 'product-name':
        return {
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
      case 'price':
        return {
          width: '120px',
          height: '32px',
          gap: '8px',
          borderRadius: '6px',
          borderWidth: '1px',
          paddingLeft: '8px',
          fontFamily: 'Pretendard',
          fontWeight: 400,
          fontSize: '14px',
          lineHeight: '22px',
          letterSpacing: '0%'
        };
      case 'product-link':
        return {
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
      case 'product-code':
        return {
          width: '344px',
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
      case 'category-1':
        return {
          width: '160px',
          height: '32px',
          gap: '4px',
          borderRadius: '6px',
          fontFamily: 'Pretendard',
          fontWeight: 400,
          fontSize: '14px',
          lineHeight: '22px',
          letterSpacing: '0%'
        };
      case 'category-2':
        return {
          width: '144px',
          height: '32px',
          top: '562px',
          left: '172px',
          fontFamily: 'Pretendard',
          fontWeight: 400,
          fontSize: '14px',
          lineHeight: '22px',
          letterSpacing: '0%'
        };
      case 'category-3':
        return {
          width: '144px',
          height: '32px',
          top: '562px',
          left: '328px',
          fontFamily: 'Pretendard',
          fontWeight: 400,
          fontSize: '14px',
          lineHeight: '22px',
          letterSpacing: '0%'
        };
      default:
        return {};
    }
  };

  const inputStyle = getVariantStyle();

  // helpText 스타일
  const helpTextStyle = {
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
    color: '#000000E0' // var(--Input-colorText, #000000E0)
  };

  return (
    <div className="space-y-1">
      {label && (
        <label className="block" style={labelStyle}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled} // disabled 속성 추가
        className={variant === 'default' ? 
          `w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-white'} ${className}` :
          `px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-white'} ${className}`
        }
        style={inputStyle}
      />
      {helpText && (
        <div className="text-gray-500" style={helpTextStyle}>
          {helpText}
        </div>
      )}
    </div>
  );
};

interface TextareaProps {
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
  label?: string;
  helpText?: string;
  rows?: number;
  disabled?: boolean; // disabled 속성 추가
  required?: boolean;
  variant?: 'default' | 'product-description';
}

const Textarea: React.FC<TextareaProps> = ({
  placeholder,
  value,
  onChange,
  className = '',
  label,
  helpText,
  rows = 3,
  disabled = false, // 기본값 설정
  required = false,
  variant = 'default'
}) => {
  // 상품설명 variant 스타일
  const getVariantStyle = () => {
    if (variant === 'product-description') {
      return {
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
    }
    return {};
  };

  // 기본 글꼴 스타일
  const textareaStyle = {
    fontFamily: 'Pretendard',
    fontWeight: 400,
    fontSize: '14px',
    lineHeight: '22px',
    letterSpacing: '0%',
    ...getVariantStyle()
  };

  // helpText 스타일
  const helpTextStyle = {
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
    color: '#000000E0' // var(--Input-colorText, #000000E0)
  };

  return (
    <div className="space-y-1">
      {label && (
        <label className="block" style={labelStyle}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled} // disabled 속성 추가
        rows={variant === 'product-description' ? 1 : rows}
        className={variant === 'default' ? 
          `w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-white'} ${className}` :
          `px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-white'} ${className}`
        }
        style={textareaStyle}
      />
      {helpText && (
        <div className="text-gray-500" style={helpTextStyle}>
          {helpText}
        </div>
      )}
    </div>
  );
};

export { Input, Textarea };
