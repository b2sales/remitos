import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
import { docClient } from '../shared/dynamo';
import { env } from '../shared/env';

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

export class EventosService {
  async registrar(params: {
    entidadId: string;
    tipo: TipoEvento;
    remitoId?: string;
    loteId?: string;
    operadorId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const now = new Date().toISOString();
    const eventoId = randomUUID();

    const evento: Evento = {
      entidad_id: params.entidadId,
      timestamp_evento_id: `${now}#${eventoId}`,
      tipo_evento: params.tipo,
      remito_id: params.remitoId,
      lote_id: params.loteId,
      operador_id: params.operadorId,
      metadata: params.metadata,
    };

    await docClient.send(
      new PutCommand({
        TableName: env.EVENTOS_TABLE,
        Item: evento,
      }),
    );
  }
}
