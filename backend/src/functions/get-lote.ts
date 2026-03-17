import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { LotesService } from '../services/lotes';
import { docClient } from '../shared/dynamo';
import { env } from '../shared/env';
import { success, error } from '../shared/response';
import { logger } from '../shared/logger';
import type { Remito } from '../models/remito';

const lotesService = new LotesService();

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const loteId = event.pathParameters?.loteId;
    if (!loteId) {
      return error('loteId es requerido', 400);
    }

    const lote = await lotesService.findById(loteId);
    if (!lote) {
      return error('Lote no encontrado', 404);
    }

    const remitosResult = await docClient.send(
      new QueryCommand({
        TableName: env.REMITOS_TABLE,
        IndexName: 'GSI1-lote',
        KeyConditionExpression: 'lote_id = :loteId',
        ExpressionAttributeValues: { ':loteId': loteId },
        ScanIndexForward: true,
      }),
    );
    const remitos = (remitosResult.Items as Remito[]) ?? [];

    logger.info('Got lote detail', { loteId, remitosCount: remitos.length });

    return success({
      ...lote,
      remitos,
    });
  } catch (err) {
    logger.error('Error getting lote', {
      error: err instanceof Error ? err.message : String(err),
    });
    return error('Error al obtener lote');
  }
};
