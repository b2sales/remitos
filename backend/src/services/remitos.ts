import { PutCommand, UpdateCommand, GetCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
import { docClient } from '../shared/dynamo';
import { env } from '../shared/env';
import type { Remito, RemitoEstado, DatosExtraidos, DatosIA } from '../models/remito';
import type { AcmasoftCliente } from './acmasoft';

export class RemitosService {
  async create(imagenKey: string): Promise<Remito> {
    const now = new Date().toISOString();
    const remito: Remito = {
      remito_id: randomUUID(),
      imagen_key: imagenKey,
      estado: 'procesando_ocr',
      es_urgente: false,
      fuera_de_horario: false,
      escaneado_en: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: env.REMITOS_TABLE,
        Item: remito,
      }),
    );

    return remito;
  }

  async findById(remitoId: string): Promise<Remito | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: env.REMITOS_TABLE,
        Key: { remito_id: remitoId },
      }),
    );
    return (result.Item as Remito) ?? null;
  }

  async updateEstado(remitoId: string, estado: RemitoEstado, extra?: Record<string, unknown>): Promise<void> {
    let updateExpr = 'SET estado = :estado';
    const exprValues: Record<string, unknown> = { ':estado': estado };

    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        if (value === undefined) continue;
        updateExpr += `, ${key} = :${key}`;
        exprValues[`:${key}`] = value;
      }
    }

    await docClient.send(
      new UpdateCommand({
        TableName: env.REMITOS_TABLE,
        Key: { remito_id: remitoId },
        UpdateExpression: updateExpr,
        ExpressionAttributeValues: exprValues,
      }),
    );
  }

  async saveOcrResult(remitoId: string, datosExtraidos: DatosExtraidos): Promise<void> {
    await this.updateEstado(remitoId, 'pendiente_ia', {
      datos_extraidos: datosExtraidos,
    });
  }

  async markOcrError(remitoId: string, errorDetalle: string): Promise<void> {
    await this.updateEstado(remitoId, 'error_ocr', {
      error_detalle: errorDetalle,
    });
  }

  async saveIaResult(
    remitoId: string,
    datosIa: DatosIA,
    matchCliente: AcmasoftCliente | null,
  ): Promise<void> {
    await this.updateEstado(remitoId, 'pendiente_validacion', {
      datos_ia: datosIa,
      remitente_normalizado: datosIa.remitente,
      destinatario_normalizado: datosIa.destinatario,
      cliente_pagador_id: matchCliente?.cliente_id ?? undefined,
      entra_validacion_en: new Date().toISOString(),
    });
  }

  async markIaError(remitoId: string, errorDetalle: string): Promise<void> {
    await this.updateEstado(remitoId, 'error_ia', {
      error_detalle: errorDetalle,
    });
  }

  async findByEstado(estado: RemitoEstado, limit = 25, lastKey?: string): Promise<{
    items: Remito[];
    count: number;
    lastKey?: string;
  }> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: env.REMITOS_TABLE,
        IndexName: 'GSI2-estado',
        KeyConditionExpression: 'estado = :estado',
        ExpressionAttributeValues: { ':estado': estado },
        Limit: limit,
        ScanIndexForward: true,
        ExclusiveStartKey: lastKey ? JSON.parse(Buffer.from(lastKey, 'base64url').toString()) : undefined,
      }),
    );
    const items = (result.Items as Remito[]) ?? [];
    return {
      items,
      count: items.length,
      lastKey: result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64url')
        : undefined,
    };
  }

  async assignLote(remitoId: string, loteId: string): Promise<void> {
    await docClient.send(
      new UpdateCommand({
        TableName: env.REMITOS_TABLE,
        Key: { remito_id: remitoId },
        UpdateExpression: 'SET lote_id = :loteId',
        ExpressionAttributeValues: { ':loteId': loteId },
      }),
    );
  }

  async search(query: string, limit = 25): Promise<Remito[]> {
    const lowerQuery = query.toLowerCase();
    const result = await docClient.send(
      new ScanCommand({
        TableName: env.REMITOS_TABLE,
        FilterExpression:
          'contains(remitente_normalizado, :q) OR contains(destinatario_normalizado, :q) OR contains(remito_id, :qraw)',
        ExpressionAttributeValues: {
          ':q': lowerQuery,
          ':qraw': query,
        },
        Limit: 500,
      }),
    );
    const items = (result.Items as Remito[]) ?? [];
    return items.slice(0, limit);
  }

  async markUrgente(remitoId: string): Promise<void> {
    const now = new Date();
    const argHour = ((now.getUTCHours() - 3 + 24) % 24);
    const fueraDeHorario = argHour < 8 || argHour >= 18;

    await docClient.send(
      new UpdateCommand({
        TableName: env.REMITOS_TABLE,
        Key: { remito_id: remitoId },
        UpdateExpression: 'SET es_urgente = :u, fuera_de_horario = :fh',
        ExpressionAttributeValues: {
          ':u': true,
          ':fh': fueraDeHorario,
        },
      }),
    );
  }

  async findByLote(loteId: string): Promise<Remito[]> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: env.REMITOS_TABLE,
        IndexName: 'GSI1-lote',
        KeyConditionExpression: 'lote_id = :loteId',
        ExpressionAttributeValues: { ':loteId': loteId },
        ScanIndexForward: true,
      }),
    );
    return (result.Items as Remito[]) ?? [];
  }

  async validar(
    remitoId: string,
    operadorId: string,
    datos: {
      remitente: string;
      destinatario: string;
      tipo_carga: string;
      unidades?: number;
      bultos?: number;
      peso_kg?: number;
      volumen_m3?: number;
      observaciones?: string;
      campos_corregidos: string[];
    },
  ): Promise<void> {
    await this.updateEstado(remitoId, 'validado', {
      datos_validados: {
        ...datos,
        validado_por: operadorId,
      },
      operador_id_validacion: operadorId,
      validado_en: new Date().toISOString(),
    });
  }
}
