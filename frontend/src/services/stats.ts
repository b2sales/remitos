import { api } from './api';

export interface StatsResumen {
  total_remitos: number;
  pendientes: number;
  validados: number;
  enviados: number;
  errores: number;
  urgentes: number;
  fuera_horario: number;
}

export interface StatsCalidad {
  pct_sin_correccion: number;
  latencia_promedio_min: number;
}

export interface StatsLotes {
  abiertos: number;
  cerrados: number;
  enviados: number;
  total: number;
}

export interface OperadorStats {
  operador_id: string;
  remitos_validados: number;
  campos_corregidos: number;
}

export interface RemitenteError {
  remitente: string;
  correcciones: number;
}

export interface DashboardStats {
  resumen: StatsResumen;
  calidad: StatsCalidad;
  lotes: StatsLotes;
  operadores: OperadorStats[];
  top_remitentes_errores: RemitenteError[];
}

export const statsApi = {
  getDashboard: () => api.get<DashboardStats>('/stats'),
};
