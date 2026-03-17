export type TipoEvento =
  | 'remito_asignado'
  | 'remito_validado'
  | 'campo_corregido'
  | 'remito_urgente'
  | 'remito_fuera_horario'
  | 'lote_abierto'
  | 'lote_cerrado'
  | 'guia_generada';

export interface Evento {
  entidad_id: string;
  timestamp_evento_id: string;
  tipo_evento: TipoEvento;
  remito_id?: string;
  lote_id?: string;
  operador_id?: string;
  metadata?: Record<string, unknown>;
}
