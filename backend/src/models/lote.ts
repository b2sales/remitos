export type LoteEstado = 'abierto' | 'cerrado' | 'en_validacion' | 'validado' | 'enviado';

export type LoteTipo = 'normal' | 'urgente';

export interface Lote {
  lote_id: string;
  tipo: LoteTipo;
  estado: LoteEstado;
  remitos_count: number;
  abierto_en: string;
  cerrado_en?: string;
  ventana_temporal?: string;
  guia_id?: string;
  numero_guia?: string;
  enviado_en?: string;
}
