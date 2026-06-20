export function format(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function startOfMonth(year: number, month: number): string {
  return new Date(year, month - 1, 1).toISOString();
}

export function endOfMonth(year: number, month: number): string {
  return new Date(year, month, 0, 23, 59, 59, 999).toISOString();
}
