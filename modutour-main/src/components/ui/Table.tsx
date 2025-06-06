import React from 'react';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

const Table: React.FC<TableProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}>
      <table className="min-w-full">
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
    <thead className="bg-gray-50">
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
}

const TableRow: React.FC<TableRowProps> = ({ children, onClick, className = '' }) => {
  return (
    <tr 
      onClick={onClick}
      className={`${onClick ? 'hover:bg-gray-50 cursor-pointer' : ''} ${className}`}
    >
      {children}
    </tr>
  );
};

interface TableHeadProps {
  children: React.ReactNode;
  className?: string;
}

const TableHead: React.FC<TableHeadProps> = ({ children, className = '' }) => {
  return (
    <th className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${className}`}>
      {children}
    </th>
  );
};

interface TableCellProps {
  children: React.ReactNode;
  className?: string;
}

const TableCell: React.FC<TableCellProps> = ({ children, className = '' }) => {
  return (
    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${className}`}>
      {children}
    </td>
  );
};

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };