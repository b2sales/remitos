import { api } from './api';

export type LoteEstado = 'abierto' | 'cerrado' | 'en_validacion' | 'validado' | 'enviado';

export interface LoteListItem {
  lote_id: string;
  tipo: 'normal' | 'urgente';
  estado: LoteEstado;
  remitos_count: number;
  abierto_en: string;
  cerrado_en?: string;
  guia_id?: string;
  numero_guia?: string;
  enviado_en?: string;
}

export interface RemitoResumen {
  remito_id: string;
  estado: string;
  remitente_normalizado?: string;
  destinatario_normalizado?: string;
  datos_validados?: {
    remitente: string;
    destinatario: string;
    tipo_carga: string;
    bultos?: number;
    peso_kg?: number;
  };
  datos_ia?: {
    remitente: string;
    destinatario: string;
    tipo_carga: string;
    bultos?: number;
    peso_kg?: number;
  };
}

export interface LoteDetail extends LoteListItem {
  remitos: RemitoResumen[];
}

export interface GuiaResponse {
  message: string;
  guia_id: string;
  numero_guia: string;
  fecha_emision: string;
  remitos_enviados: number;
}

export const lotesApi = {
  list: (estado: LoteEstado = 'cerrado') =>
    api.get<{ items: LoteListItem[]; count: number }>(`/lotes?estado=${estado}`),

  getDetail: (loteId: string) =>
    api.get<LoteDetail>(`/lotes/${loteId}`),

  generarGuia: (loteId: string) =>
    api.post<GuiaResponse>(`/lotes/${loteId}/guia`, {}),
};
