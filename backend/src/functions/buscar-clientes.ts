import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { AcmasoftMockService } from '../services/acmasoft-mock';
import { success, error } from '../shared/response';
import { logger } from '../shared/logger';

const acmasoftService = new AcmasoftMockService();

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const q = event.queryStringParameters?.q;
    if (!q || q.length < 2) {
      return error('El parámetro "q" es requerido (mínimo 2 caracteres)', 400);
    }

    const clientes = await acmasoftService.buscarClientes(q);

    logger.info('Client search', { query: q, results: clientes.length });

    return success({ items: clientes, count: clientes.length });
  } catch (err) {
    logger.error('Error searching clients', {
      error: err instanceof Error ? err.message : String(err),
    });
    return error('Error al buscar clientes');
  }
};
