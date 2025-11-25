import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Форматирует число с разделителями тысяч
 * @param value - Число для форматирования
 * @param decimals - Количество знаков после запятой (по умолчанию 0)
 * @returns Отформатированная строка (например: "1 000 000.50")
 */
export function formatNumber(value: number | string, decimals: number = 0): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) return '0';

  // Округляем до нужного количества знаков
  const rounded = decimals > 0 ? num.toFixed(decimals) : Math.round(num).toString();

  // Разделяем на целую и дробную части
  const [integerPart, decimalPart] = rounded.split('.');

  // Добавляем разделители тысяч (пробелы)
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  // Возвращаем с дробной частью если есть (разделитель - точка)
  return decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger;
}