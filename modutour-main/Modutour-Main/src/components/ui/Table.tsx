import React from 'react';

interface TableProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const Table: React.FC<TableProps> = ({ children, className = '', style }) => {
  const tableStyle = {
    width: '585px',
    height: '804px',
    tableLayout: 'fixed' as const, // 고정 레이아웃으로 설정
    ...style
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`} style={tableStyle}>
      <table className="w-full border-collapse" style={tableStyle}>
        {children}
      </table>
    </div>
  );
};

interface TableHeaderProps {
  children: React.ReactNode;
}

const TableHeader: React.FC<TableHeaderProps> = ({ children }) => {
  return (
    <thead style={{ background: '#00000005' }}>
      {children}
    </thead>
  );
};

interface TableBodyProps {
  children: React.ReactNode;
}

const TableBody: React.FC<TableBodyProps> = ({ children }) => {
  return (
    <tbody className="bg-white divide-y divide-gray-200">
      {children}
    </tbody>
  );
};

interface TableRowProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  isSelected?: boolean;
}

const TableRow: React.FC<TableRowProps> = ({ children, onClick, className = '', isSelected = false }) => {
  const rowStyle = isSelected ? {
    background: '#0000000F'
  } : {};

  return (
    <tr 
      onClick={onClick}
      className={`${onClick ? 'hover:bg-gray-50 cursor-pointer' : ''} ${className}`}
      style={rowStyle}
    >
      {children}
    </tr>
  );
};

interface TableHeadProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  width?: number;
}

const TableHead: React.FC<TableHeadProps> = ({ children, className = '', style, width }) => {
  const headStyle = {
    fontFamily: 'Pretendard',
    fontWeight: 600,
    fontSize: '14px',
    lineHeight: '22px',
    letterSpacing: '0%',
    verticalAlign: 'middle',
    color: '#000000E0',
    height: '38px',
    width: width ? `${width}px` : undefined,
    borderRight: '1px solid #e5e7eb',
    ...style
  };

  return (
    <th 
      className={`px-6 py-3 text-left ${className}`}
      style={headStyle}
    >
      {children}
    </th>
  );
};

interface TableCellProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  colSpan?: number;
  ellipsis?: boolean; // 말줄임표 옵션 추가
}

const TableCell: React.FC<TableCellProps> = ({ 
  children, 
  className = '', 
  style, 
  title, 
  colSpan,
  ellipsis = false 
}) => {
  const cellStyle = {
    height: '38px',
    borderRight: '1px solid #e5e7eb',
    ...(ellipsis && {
      maxWidth: '0', // 유연한 너비 설정
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const
    }),
    ...style
  };

  // ellipsis가 true이고 title이 없으면 children을 title로 사용
  const cellTitle = ellipsis && !title && typeof children === 'string' ? children : title;

  return (
    <td 
      className={`px-6 py-4 text-sm text-gray-900 ${ellipsis ? '' : 'whitespace-nowrap'} ${className}`}
      style={cellStyle}
      title={cellTitle}
      colSpan={colSpan}
    >
      {ellipsis ? (
        <div 
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {children}
        </div>
      ) : (
        children
      )}
    </td>
  );
};

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
