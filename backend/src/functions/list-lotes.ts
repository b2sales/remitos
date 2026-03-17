import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { LotesService } from '../services/lotes';
import { success, error } from '../shared/response';
import { logger } from '../shared/logger';
import type { LoteEstado } from '../models/lote';

const lotesService = new LotesService();

const VALID_ESTADOS: LoteEstado[] = ['abierto', 'cerrado', 'en_validacion', 'validado', 'enviado'];

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const estado = (event.queryStringParameters?.estado ?? 'abierto') as LoteEstado;

    if (!VALID_ESTADOS.includes(estado)) {
      return error(`Estado inválido: ${estado}`, 400);
    }

    const lotes = await lotesService.findByEstado(estado);

    logger.info('Listed lotes', { estado, count: lotes.length });

    return success({ items: lotes, count: lotes.length });
  } catch (err) {
    logger.error('Error listing lotes', {
      error: err instanceof Error ? err.message : String(err),
    });
    return error('Error al listar lotes');
  }
};
