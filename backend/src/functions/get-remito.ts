import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { RemitosService } from '../services/remitos';
import { success, error } from '../shared/response';
import { logger } from '../shared/logger';
import { env } from '../shared/env';

const s3 = new S3Client({});
const remitosService = new RemitosService();

const PRESIGNED_URL_EXPIRY = 900; // 15 minutes

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const remitoId = event.pathParameters?.remitoId;
    if (!remitoId) {
      return error('remitoId es requerido', 400);
    }

    const remito = await remitosService.findById(remitoId);
    if (!remito) {
      return error('Remito no encontrado', 404);
    }

    const command = new GetObjectCommand({
      Bucket: env.IMAGES_BUCKET,
      Key: remito.imagen_key,
    });
    const imagenUrl = await getSignedUrl(s3, command, {
      expiresIn: PRESIGNED_URL_EXPIRY,
    });

    logger.info('Got remito detail', { remitoId });

    return success({
      ...remito,
      imagen_url: imagenUrl,
    });
  } catch (err) {
    logger.error('Error getting remito', {
      error: err instanceof Error ? err.message : String(err),
    });
    return error('Error al obtener remito');
  }
};
