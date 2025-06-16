import React from 'react';
import { UploadOutlined } from '@ant-design/icons';
import { Button, message, Upload } from 'antd';
import { Image } from 'lucide-react';

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
  const uploadProps = {
    name: 'file',
    action: 'https://www.mocky.io/v2/5cc8019d300000980a055e76',
    headers: {
      authorization: 'authorization-text',
    },
    onChange(info: any) {
      if (info.file.status !== 'uploading') {
        console.log(info.file, info.fileList);
      }

      if (info.file.status === 'done') {
        message.success(`${info.file.name} file uploaded successfully`);
        if (onUpload) {
          onUpload();
        }
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} file upload failed.`);
      }
    },
  };

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
        
        {fileName && (
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <span>{fileName}</span>
          </div>
        )}
        
        <Upload {...uploadProps}>
          <Button 
            icon={<UploadOutlined />}
            className="flex items-center gap-2"
          >
            Upload
          </Button>
        </Upload>
      </div>
    </div>
  );
};

export default FileUpload;