import React from 'react';
import { Card } from '../components/ui/Card';
import PasswordInput from '../components/ui/PasswordInput';
import Button from '../components/ui/Button';

const AccountSettings: React.FC = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">계정 설정</h1>
      
      <Card className="p-6 max-w-5xl">
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

          <Button className="w-full">저장</Button>
        </div>
      </Card>
    </div>
  );
};

export default AccountSettings;
