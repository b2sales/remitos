import { api } from './api';

export type RemitoEstado =
  | 'procesando_ocr'
  | 'error_ocr'
  | 'pendiente_ia'
  | 'error_ia'
  | 'pendiente_validacion'
  | 'validado'
  | 'enviado_acmasoft'
  | 'error_acmasoft';

export interface DatosIA {
  remitente: string;
  destinatario: string;
  tipo_carga: string;
  unidades?: number;
  bultos?: number;
  peso_kg?: number;
  volumen_m3?: number;
  observaciones?: string;
  confianza: Record<string, number>;
}

export interface RemitoListItem {
  remito_id: string;
  estado: RemitoEstado;
  remitente_normalizado?: string;
  destinatario_normalizado?: string;
  escaneado_en: string;
  entra_validacion_en?: string;
  es_urgente: boolean;
}

export interface RemitoDetail {
  remito_id: string;
  imagen_key: string;
  imagen_url: string;
  estado: RemitoEstado;
  datos_ia?: DatosIA;
  remitente_normalizado?: string;
  destinatario_normalizado?: string;
  cliente_pagador_id?: string;
  es_urgente: boolean;
  escaneado_en: string;
}

export interface ValidarRemitoPayload {
  remitente: string;
  destinatario: string;
  tipo_carga: string;
  unidades?: number;
  bultos?: number;
  peso_kg?: number;
  volumen_m3?: number;
  observaciones?: string;
  campos_corregidos: string[];
}

export interface PaginatedResponse<T> {
  items: T[];
  count: number;
  lastKey?: string;
}

export interface UploadPresignResponse {
  uploads: {
    filename: string;
    key: string;
    upload_url: string;
  }[];
}

export const remitosApi = {
  listPendientes: (lastKey?: string) =>
    api.get<PaginatedResponse<RemitoListItem>>(
      `/remitos?estado=pendiente_validacion${lastKey ? `&lastKey=${lastKey}` : ''}`,
    ),

  getDetail: (remitoId: string) =>
    api.get<RemitoDetail>(`/remitos/${remitoId}`),

  validar: (remitoId: string, data: ValidarRemitoPayload) =>
    api.put<{ message: string }>(`/remitos/${remitoId}/validar`, data),

  getUploadUrls: (files: { filename: string; content_type: string }[]) =>
    api.post<UploadPresignResponse>('/remitos/upload', { files }),
};
