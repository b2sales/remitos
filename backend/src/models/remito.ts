export type RemitoEstado =
  | 'procesando_ocr'
  | 'error_ocr'
  | 'pendiente_ia'
  | 'error_ia'
  | 'pendiente_validacion'
  | 'validado'
  | 'enviado_acmasoft'
  | 'error_acmasoft';

export interface DatosExtraidos {
  texto_crudo: string;
  confianza_promedio: number;
  lineas: string[];
}

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

export interface DatosValidados extends DatosIA {
  validado_por: string;
  campos_corregidos: string[];
}

export interface Remito {
  remito_id: string;
  imagen_key: string;
  estado: RemitoEstado;
  lote_id?: string;
  datos_extraidos?: DatosExtraidos;
  datos_ia?: DatosIA;
  datos_validados?: DatosValidados;
  remitente_normalizado?: string;
  destinatario_normalizado?: string;
  cliente_pagador_id?: string;
  operador_id_validacion?: string;
  es_urgente: boolean;
  fuera_de_horario: boolean;
  error_detalle?: string;
  escaneado_en: string;
  entra_validacion_en?: string;
  validado_en?: string;
  enviado_acmasoft_en?: string;
}
