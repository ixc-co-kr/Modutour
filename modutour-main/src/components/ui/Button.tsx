import React from 'react';
import { Button as AntButton } from 'antd';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'outline' | 'save' | 'reset' | 'new-product';
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'default',
  className = '',
  type = 'button'
}) => {
  const getVariantStyle = () => {
    switch (variant) {
      case 'save':
        return {
          width: '100px',
          height: '32px',
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
        };
      case 'reset':
        return {
          width: '69px',
          height: '32px',
          gap: '8px',
          borderRadius: '6px',
          borderWidth: '1px',
          paddingRight: '16px',
          paddingLeft: '16px',
          fontFamily: 'Pretendard',
          fontWeight: 400,
          fontSize: '14px',
          lineHeight: '22px',
          letterSpacing: '0%'
        };
      case 'new-product':
        return {
          width: '136px',
          height: '32px', // Radio/controlHeight
          gap: '8px',
          borderWidth: '1px',
          paddingRight: '16px', // Radio/padding
          paddingLeft: '16px', // Radio/padding
          borderTopLeftRadius: '6px', // Button/borderRadius
          borderTopRightRadius: '6px', // Radio/borderRadius
          borderBottomRightRadius: '6px', // Radio/borderRadius
          borderBottomLeftRadius: '6px', // Button/borderRadius
          background: '#1677FF', // var(--Button-colorPrimary, #1677FF)
          border: '1px solid #1677FF', // 1px solid var(--Button-colorPrimary, #1677FF)
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

  const buttonStyle = getVariantStyle();

  // save, reset, new-product variant는 Ant Design Button 사용
  if (variant === 'save' || variant === 'new-product') {
    return (
      <AntButton
        type="primary"
        onClick={onClick}
        style={buttonStyle}
        className={className}
      >
        {children}
      </AntButton>
    );
  }

  if (variant === 'reset') {
    return (
      <AntButton
        onClick={onClick}
        style={buttonStyle}
        className={className}
      >
        {children}
      </AntButton>
    );
  }

  // 기본 버튼들은 기존 스타일 유지
  const baseClasses = 'font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    default: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
    outline: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 focus:ring-blue-500',
    save: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
    reset: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 focus:ring-blue-500',
    'new-product': 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]} px-4 py-2 rounded-md ${className}`}
      style={buttonStyle}
    >
      {children}
    </button>
  );
};

export default Button;
