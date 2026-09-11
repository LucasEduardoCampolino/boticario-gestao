// src/lib/date.ts

/**
 * Retorna o primeiro e último dia do mês no formato YYYY-MM-DD
 * @param monthString - String no formato "YYYY-MM" (ex: "2026-09")
 */
export function getMonthRange(monthString: string) {
  const [year, month] = monthString.split('-').map(Number)

  // Primeiro dia do mês
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`

  // Último dia do mês (dia 0 do próximo mês = último dia do mês atual)
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  return { startDate, endDate }
}