import { formatRupiah } from './format';

export const exportToCSV = (filename, headers, rows) => {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      if (cell === null || cell === undefined) return '""';
      const str = String(cell);
      // Escape quotes and wrap in quotes if contains comma
      return str.includes(',') || str.includes('"') 
        ? `"${str.replace(/"/g, '""')}"` 
        : str;
    }).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
