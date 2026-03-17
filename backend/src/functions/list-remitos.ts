import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { RemitosService } from '../services/remitos';
import { success, error } from '../shared/response';
import { logger } from '../shared/logger';
import type { RemitoEstado } from '../models/remito';

const remitosService = new RemitosService();

const VALID_ESTADOS: RemitoEstado[] = [
  'procesando_ocr',
  'error_ocr',
  'pendiente_ia',
  'error_ia',
  'pendiente_validacion',
  'validado',
  'enviado_acmasoft',
  'error_acmasoft',
];

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const estado = (event.queryStringParameters?.estado ?? 'pendiente_validacion') as RemitoEstado;
    const lastKey = event.queryStringParameters?.lastKey;

    if (!VALID_ESTADOS.includes(estado)) {
      return error(`Estado inválido: ${estado}`, 400);
    }

    const result = await remitosService.findByEstado(estado, 25, lastKey);

    logger.info('Listed remitos', { estado, count: result.count });

    return success(result);
  } catch (err) {
    logger.error('Error listing remitos', {
      error: err instanceof Error ? err.message : String(err),
    });
    return error('Error al listar remitos');
  }
};
