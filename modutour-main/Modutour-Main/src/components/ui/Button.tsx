import React from 'react';
import { Button as AntButton } from 'antd';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void | Promise<void>;
  variant?: 'default' | 'outline' | 'save' | 'reset' | 'new-product' | 'edit' | 'delete';  // edit, delete 추가
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'default',
  className = '',
  type = 'button',
  disabled = false
}) => {
  const getVariantStyle = () => {
    const baseStyle = {
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer'
    };

    switch (variant) {
      case 'save':
        return {
          ...baseStyle,
          width: '100px',
          height: '32px',
          gap: '8px',
          borderRadius: '6px',
          borderWidth: '1px',
          paddingRight: '16px',
          paddingLeft: '16px',
          background: disabled ? '#d9d9d9' : '#1677FF',
          border: disabled ? '1px solid #d9d9d9' : '1px solid #1677FF',
          fontFamily: 'Pretendard',
          fontWeight: 400,
          fontSize: '14px',
          lineHeight: '22px',
          letterSpacing: '0%'
        };
      case 'edit':  // 수정 버튼 스타일 추가
        return {
          ...baseStyle,
          width: '57px',
          height: '32px',
          gap: '8px',
          borderRadius: '6px',
          borderWidth: '1px',
          paddingRight: '16px',
          paddingLeft: '16px',
          background: disabled ? '#d9d9d9' : '#1677FF',
          border: disabled ? '1px solid #d9d9d9' : '1px solid #1677FF',
          fontFamily: 'Pretendard',
          fontWeight: 400,
          fontSize: '14px',
          lineHeight: '22px',
          letterSpacing: '0%'
        };
      case 'reset':
        return {
          ...baseStyle,
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
      case 'delete':  // 삭제 버튼 스타일 추가
        return {
          ...baseStyle,
          width: '57px',
          height: '32px',
          gap: '8px',
          borderRadius: '6px',
          borderWidth: '1px',
          paddingRight: '16px',
          paddingLeft: '16px',
          background: '#FFFFFF',
          border: '1px solid #FF4D4F',
          color: '#FF4D4F',  // 폰트 색상
          fontFamily: 'Pretendard',
          fontWeight: 400,
          fontSize: '14px',
          lineHeight: '22px',
          letterSpacing: '0%'
        };
      case 'new-product':
        return {
          ...baseStyle,
          width: '136px',
          height: '32px',
          gap: '8px',
          borderWidth: '1px',
          paddingRight: '16px',
          paddingLeft: '16px',
          borderTopLeftRadius: '6px',
          borderTopRightRadius: '6px',
          borderBottomRightRadius: '6px',
          borderBottomLeftRadius: '6px',
          background: disabled ? '#d9d9d9' : '#1677FF',
          border: disabled ? '1px solid #d9d9d9' : '1px solid #1677FF',
          fontFamily: 'Pretendard',
          fontWeight: 400,
          fontSize: '14px',
          lineHeight: '22px',
          letterSpacing: '0%'
        };
      default:
        return baseStyle;
    }
  };

  const buttonStyle = getVariantStyle();

  // save, edit, new-product variant는 Ant Design Button 사용
  if (variant === 'save' || variant === 'new-product' || variant === 'edit') {
    return (
      <AntButton
        type="primary"
        onClick={onClick}
        style={buttonStyle}
        className={className}
        disabled={disabled}
      >
        {children}
      </AntButton>
    );
  }

  // delete variant는 danger 속성 사용
  if (variant === 'delete') {
    return (
      <AntButton
        danger
        onClick={onClick}
        style={buttonStyle}
        className={className}
        disabled={disabled}
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
        disabled={disabled}
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
    edit: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
    reset: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 focus:ring-blue-500',
    delete: 'bg-white hover:bg-red-50 text-red-500 border border-red-500 focus:ring-red-500',
    'new-product': 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500'
  };

  const disabledClasses = disabled 
    ? 'opacity-50 cursor-not-allowed' 
    : 'hover:opacity-80';

  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${disabledClasses} px-4 py-2 rounded-md ${className}`}
      style={buttonStyle}
    >
      {children}
    </button>
  );
};

export default Button;
