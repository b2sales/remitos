import {
  PutCommand,
  UpdateCommand,
  GetCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
import { docClient } from '../shared/dynamo';
import { env } from '../shared/env';
import type { Lote, LoteEstado, LoteTipo } from '../models/lote';

const MAX_REMITOS_PER_LOTE = 50;
const INACTIVITY_MINUTES = 30;
const CUTOFF_HOUR = 17;
const CUTOFF_MINUTE = 30;

export class LotesService {
  async findById(loteId: string): Promise<Lote | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: env.LOTES_TABLE,
        Key: { lote_id: loteId },
      }),
    );
    return (result.Item as Lote) ?? null;
  }

  async findByEstado(estado: LoteEstado, limit = 25): Promise<Lote[]> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: env.LOTES_TABLE,
        IndexName: 'GSI1-estado',
        KeyConditionExpression: 'estado = :estado',
        ExpressionAttributeValues: { ':estado': estado },
        Limit: limit,
        ScanIndexForward: false,
      }),
    );
    return (result.Items as Lote[]) ?? [];
  }

  async findOpenLote(tipo: LoteTipo = 'normal'): Promise<Lote | null> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: env.LOTES_TABLE,
        IndexName: 'GSI1-estado',
        KeyConditionExpression: 'estado = :estado',
        FilterExpression: 'tipo = :tipo',
        ExpressionAttributeValues: {
          ':estado': 'abierto',
          ':tipo': tipo,
        },
        Limit: 1,
        ScanIndexForward: false,
      }),
    );
    const lotes = (result.Items as Lote[]) ?? [];
    return lotes[0] ?? null;
  }

  async create(tipo: LoteTipo = 'normal'): Promise<Lote> {
    const now = new Date().toISOString();
    const lote: Lote = {
      lote_id: randomUUID(),
      tipo,
      estado: 'abierto',
      remitos_count: 0,
      abierto_en: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: env.LOTES_TABLE,
        Item: lote,
      }),
    );

    return lote;
  }

  async incrementRemitosCount(loteId: string): Promise<number> {
    const result = await docClient.send(
      new UpdateCommand({
        TableName: env.LOTES_TABLE,
        Key: { lote_id: loteId },
        UpdateExpression: 'SET remitos_count = remitos_count + :one',
        ExpressionAttributeValues: { ':one': 1 },
        ReturnValues: 'ALL_NEW',
      }),
    );
    return (result.Attributes as Lote).remitos_count;
  }

  async cerrar(loteId: string): Promise<void> {
    await docClient.send(
      new UpdateCommand({
        TableName: env.LOTES_TABLE,
        Key: { lote_id: loteId },
        UpdateExpression: 'SET estado = :estado, cerrado_en = :now',
        ExpressionAttributeValues: {
          ':estado': 'cerrado',
          ':now': new Date().toISOString(),
        },
        ConditionExpression: 'estado = :abierto',
        ExpressionAttributeNames: undefined,
      }),
    );
  }

  async assignRemitoToLote(remitoId: string): Promise<{
    lote: Lote;
    created: boolean;
    closed: boolean;
  }> {
    let created = false;
    let closed = false;

    let lote = await this.findOpenLote('normal');

    if (!lote) {
      lote = await this.create('normal');
      created = true;
    }

    const newCount = await this.incrementRemitosCount(lote.lote_id);

    if (newCount >= MAX_REMITOS_PER_LOTE) {
      await this.cerrar(lote.lote_id);
      closed = true;
    }

    return { lote: { ...lote, remitos_count: newCount }, created, closed };
  }

  async createUrgente(remitosCount: number): Promise<Lote> {
    const now = new Date().toISOString();
    const lote: Lote = {
      lote_id: randomUUID(),
      tipo: 'urgente',
      estado: 'cerrado',
      remitos_count: remitosCount,
      abierto_en: now,
      cerrado_en: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: env.LOTES_TABLE,
        Item: lote,
      }),
    );

    return lote;
  }

  async marcarEnviado(loteId: string, guiaId: string, numeroGuia: string): Promise<void> {
    await docClient.send(
      new UpdateCommand({
        TableName: env.LOTES_TABLE,
        Key: { lote_id: loteId },
        UpdateExpression: 'SET estado = :estado, guia_id = :guiaId, numero_guia = :numGuia, enviado_en = :now',
        ExpressionAttributeValues: {
          ':estado': 'enviado',
          ':guiaId': guiaId,
          ':numGuia': numeroGuia,
          ':now': new Date().toISOString(),
        },
      }),
    );
  }

  shouldCloseByInactivity(lote: Lote): boolean {
    const lastActivity = new Date(lote.abierto_en);
    const now = new Date();
    const diffMs = now.getTime() - lastActivity.getTime();
    return diffMs > INACTIVITY_MINUTES * 60 * 1000 && lote.remitos_count > 0;
  }

  shouldCloseByCutoff(): boolean {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    const argHour = (utcHour - 3 + 24) % 24;
    return argHour > CUTOFF_HOUR || (argHour === CUTOFF_HOUR && utcMinute >= CUTOFF_MINUTE);
  }
}
