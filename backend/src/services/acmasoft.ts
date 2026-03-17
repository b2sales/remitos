export interface AcmasoftCliente {
  cliente_id: string;
  razon_social: string;
  cuit: string;
  direccion: string;
  localidad: string;
  provincia: string;
  telefono?: string;
}

export interface AcmasoftGuia {
  guia_id: string;
  numero_guia: string;
  fecha_emision: string;
  estado: string;
}

export interface AcmasoftGuiaPayload {
  cliente_pagador_id: string;
  remitente: string;
  destinatario: string;
  tipo_carga: string;
  bultos: number;
  peso_kg: number;
  observaciones?: string;
  remitos_ids: string[];
}

export interface IAcmasoftService {
  buscarClientes(query: string): Promise<AcmasoftCliente[]>;
  obtenerCliente(clienteId: string): Promise<AcmasoftCliente | null>;
  generarGuia(payload: AcmasoftGuiaPayload): Promise<AcmasoftGuia>;
}
