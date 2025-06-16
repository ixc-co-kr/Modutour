import React from 'react';
import { Button } from 'antd';
import { Card } from '../components/ui/Card';
import PasswordInput from '../components/ui/PasswordInput';

interface AccountSettingsProps {
  onLogout?: () => void;
}

const AccountSettings: React.FC<AccountSettingsProps> = ({ onLogout }) => {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">계정 설정</h1>
      
      <div 
        className="bg-white border border-gray-200"
        style={{
          width: '943px',
          height: '378px',
          top: '84px',
          left: '24px',
          gap: '10px',
          borderRadius: '6px',
          borderWidth: '1px',
          paddingTop: '16px',    // padding
          paddingRight: '32px',  // paddingLG
          paddingBottom: '16px', // padding
          paddingLeft: '32px',   // paddingLG
        }}
      >
        <div className="space-y-6">
          <PasswordInput
            label="현재 비밀번호"
            placeholder="Password"
          />

          <PasswordInput
            label="새 비밀번호"
            placeholder="Password"
            helpText="8자 이상 / 영문 + 숫자 조합 필수 / 특수문자 1개 이상 권장"
          />

          <PasswordInput
            label="비밀번호 확인"
            placeholder="Password"
          />

          <Button 
            type="primary"
            style={{
              width: '57px',
              height: '32px',
              gap: '8px',
              borderRadius: '6px',
              borderWidth: '1px',
              paddingRight: '16px',
              paddingLeft: '16px',
              background: '#1677FF',
              border: '1px solid #1677FF'
            }}
          >
            저장
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;