import React, { useState } from 'react';
import { UploadOutlined } from '@ant-design/icons';
import { Button, message, Upload } from 'antd';
import { Image } from 'lucide-react';
import type { UploadProps, UploadFile } from 'antd';

interface FileUploadProps {
  label?: string;
  fileName?: string;
  onUpload?: (fileName: string, imageUrl?: string) => void;
  className?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  label,
  fileName,
  onUpload,
  className = '',
}) => {
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string>(''); // 이미지 미리보기 URL
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  // 파일 확장자 검증 함수
  const beforeUpload = (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic'];
    const allowedExtensions = ['.jpeg', '.jpg', '.png', '.heic'];
    
    const isValidType = allowedTypes.includes(file.type);
    const isValidExtension = allowedExtensions.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );

    if (!isValidType && !isValidExtension) {
      message.error('JPEG, PNG, HEIC 파일만 업로드 가능합니다.');
      return false;
    }

    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('파일 크기는 10MB 이하여야 합니다.');
      return false;
    }

    return true;
  };

  // 이미지 미리보기 생성 함수
  const createImagePreview = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      setImagePreview(imageUrl);
    };
    reader.readAsDataURL(file);
  };

  // 실제 파일 업로드를 위한 커스텀 업로드 함수
  const customUpload = (options: any) => {
    const { onSuccess, onError, file } = options;
    
    // 이미지 미리보기 생성
    createImagePreview(file);
    
    // 실제 서버 업로드 대신 로컬에서 파일 처리 (개발용)
    setTimeout(() => {
      try {
        // 파일 업로드 성공 시뮬레이션
        setUploadedFileName(file.name);
        if (onUpload) {
          onUpload(file.name, URL.createObjectURL(file));
        }
        onSuccess("ok");
        message.success(`${file.name} 파일이 성공적으로 업로드되었습니다.`);
      } catch (error) {
        onError(error);
        message.error(`${file.name} 파일 업로드에 실패했습니다.`);
      }
    }, 1000);
  };

  const uploadProps: UploadProps = {
    name: 'file',
    accept: '.jpeg,.jpg,.png,.heic',
    maxCount: 1,
    fileList: fileList,
    beforeUpload: beforeUpload,
    customRequest: customUpload,
    onChange(info) {
      let newFileList = [...info.fileList];
      newFileList = newFileList.slice(-1);

      if (info.file.status === 'removed') {
        setUploadedFileName('');
        setImagePreview('');
        if (onUpload) {
          onUpload('', '');
        }
      }

      setFileList(newFileList);
    },
    onRemove: () => {
      setUploadedFileName('');
      setImagePreview('');
      setFileList([]);
      if (onUpload) {
        onUpload('', '');
      }
    },
  };

  // 라벨 스타일
  const labelStyle = {
    fontFamily: 'Pretendard',
    fontWeight: 400,
    fontSize: '14px',
    lineHeight: '22px',
    letterSpacing: '0%',
    color: '#000000E0'
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700" style={labelStyle}>
          {label}
        </label>
      )}
      
      <div className="space-y-3">
        {/* 이미지 미리보기 영역 */}
        <div className="w-32 h-24 bg-gray-200 rounded-md flex items-center justify-center border border-gray-300 overflow-hidden">
          {imagePreview ? (
            <img 
              src={imagePreview} 
              alt="미리보기" 
              className="w-full h-full object-cover"
            />
          ) : (
            <Image className="w-8 h-8 text-gray-400" />
          )}
        </div>
        
        {/* 실제 업로드된 파일명만 표시, 없으면 빈칸 */}
        <div className="flex items-center gap-2 text-sm text-blue-600 min-h-[20px]">
          {uploadedFileName ? (
            <span>{uploadedFileName}</span>
          ) : (
            <span></span>
          )}
        </div>
        
        <Upload {...uploadProps} showUploadList={false}>
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
