import React from 'react';
import { Upload, Paperclip, Image } from 'lucide-react';

interface FileUploadProps {
  label?: string;
  fileName?: string;
  onUpload?: () => void;
  className?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  label,
  fileName,
  onUpload,
  className = '',
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      
      <div className="space-y-3">
        <div className="w-32 h-24 bg-gray-200 rounded-md flex items-center justify-center">
          <Image className="w-8 h-8 text-gray-400" />
        </div>
        
        <div className="flex items-center gap-2 text-sm text-blue-600">
          <Paperclip className="w-4 h-4" />
          filename.png
        </div>
        
        <button
          type="button"
          onClick={onUpload}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <Upload className="w-4 h-4" />
          Upload
        </button>
      </div>
    </div>
  );
};

export default FileUpload;
