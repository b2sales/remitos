import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { RemitosService } from '../services/remitos';
import { success, error } from '../shared/response';
import { logger } from '../shared/logger';

const remitosService = new RemitosService();

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const q = event.queryStringParameters?.q;
    if (!q || q.length < 2) {
      return error('El parámetro "q" es requerido (mínimo 2 caracteres)', 400);
    }

    const remitos = await remitosService.search(q);

    logger.info('Search remitos', { query: q, results: remitos.length });

    return success({ items: remitos, count: remitos.length });
  } catch (err) {
    logger.error('Error searching remitos', {
      error: err instanceof Error ? err.message : String(err),
    });
    return error('Error al buscar remitos');
  }
};
