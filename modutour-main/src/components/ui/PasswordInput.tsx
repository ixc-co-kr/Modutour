import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps {
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  label?: string;
  helpText?: string;
  required?: boolean;
}

const PasswordInput: React.FC<PasswordInputProps> = ({
  placeholder,
  value,
  onChange,
  className = '',
  label,
  helpText,
  required = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
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
          className={`w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`}
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
        <div className="text-xs text-gray-500">{helpText}</div>
      )}
    </div>
  );
};

export default PasswordInput;