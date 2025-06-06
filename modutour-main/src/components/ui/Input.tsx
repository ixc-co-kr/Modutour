import React from 'react';

interface InputProps {
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  label?: string;
  helpText?: string;
  required?: boolean;
}

const Input: React.FC<InputProps> = ({
  type = 'text',
  placeholder,
  value,
  onChange,
  className = '',
  label,
  helpText,
  required = false,
}) => {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`}
      />
      {helpText && (
        <div className="text-xs text-gray-500">{helpText}</div>
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
  required?: boolean;
}

const Textarea: React.FC<TextareaProps> = ({
  placeholder,
  value,
  onChange,
  className = '',
  label,
  helpText,
  rows = 3,
  required = false,
}) => {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        rows={rows}
        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`}
      />
      {helpText && (
        <div className="text-xs text-gray-500">{helpText}</div>
      )}
    </div>
  );
};

export { Input, Textarea };