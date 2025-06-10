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
    ...style
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`} style={tableStyle}>
      <table className="w-full table-fixed border-collapse"> {/* border-collapse 추가 */}
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
  isSelected?: boolean; // 선택 상태 prop 추가
}

const TableRow: React.FC<TableRowProps> = ({ children, onClick, className = '', isSelected = false }) => {
  const rowStyle = isSelected ? {
    background: '#0000000F' // var(--colorFillContent, #0000000F)
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
    borderRight: '1px solid #e5e7eb', // 세로 줄 추가
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
}

const TableCell: React.FC<TableCellProps> = ({ children, className = '', style, title }) => {
  const cellStyle = {
    width: '585px', // 셀 너비 지정
    height: '38px', // 셀 높이 지정
    borderRight: '1px solid #e5e7eb', // 세로 줄 추가
    ...style
  };

  return (
    <td 
      className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${className}`}
      style={cellStyle}
      title={title}
    >
      {children}
    </td>
  );
};

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
