import * as XLSX from 'xlsx';
import { MonthlyReportRow } from '../models/app.models';

/** Shared by admin and platform report pages — pure, no Supabase/DI coupling. */
export function exportMonthlyReportCsv(rows: MonthlyReportRow[], filename: string): void {
  const headers = ['Employee', 'Email', 'Department', 'Month', 'Total Votes', 'Favorite Meal'];
  const values = rows.map((row) => [row.employeeName, row.email, row.department, row.month, row.totalVotes, row.favoriteMeal]);
  const csv = [headers, ...values]
    .map((line) => line.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n');

  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
}

export function exportMonthlyReportExcel(rows: MonthlyReportRow[], filename: string): void {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  downloadBlob(new Blob([buffer], { type: 'application/octet-stream' }), `${filename}.xlsx`);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}
