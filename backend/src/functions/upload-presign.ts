import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { success, error } from '../shared/response';
import { logger } from '../shared/logger';
import { env } from '../shared/env';

const s3 = new S3Client({});

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/tiff', 'application/pdf'];
const MAX_FILES = 20;
const PRESIGN_EXPIRY = 300;

interface UploadRequest {
  files: { filename: string; content_type: string }[];
}

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const operadorId = event.requestContext.authorizer?.azure_oid;
    if (!operadorId) {
      return error('No autorizado', 401);
    }

    if (!event.body) {
      return error('Body es requerido', 400);
    }

    const body = JSON.parse(event.body) as UploadRequest;

    if (!body.files || body.files.length === 0) {
      return error('Se requiere al menos un archivo', 400);
    }

    if (body.files.length > MAX_FILES) {
      return error(`Máximo ${MAX_FILES} archivos por solicitud`, 400);
    }

    const invalidTypes = body.files.filter(
      (f) => !ALLOWED_TYPES.includes(f.content_type),
    );
    if (invalidTypes.length > 0) {
      return error(
        `Tipos no permitidos: ${invalidTypes.map((f) => f.content_type).join(', ')}. Permitidos: ${ALLOWED_TYPES.join(', ')}`,
        400,
      );
    }

    const uploads = await Promise.all(
      body.files.map(async (file) => {
        const ext = file.filename.split('.').pop() ?? 'jpg';
        const key = `uploads/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;

        const command = new PutObjectCommand({
          Bucket: env.IMAGES_BUCKET,
          Key: key,
          ContentType: file.content_type,
          Metadata: {
            'uploaded-by': operadorId,
            'original-filename': file.filename,
          },
        });

        const presignedUrl = await getSignedUrl(s3, command, {
          expiresIn: PRESIGN_EXPIRY,
        });

        return {
          filename: file.filename,
          key,
          upload_url: presignedUrl,
        };
      }),
    );

    logger.info('Generated presigned URLs', {
      count: uploads.length,
      operadorId,
    });

    return success({ uploads });
  } catch (err) {
    logger.error('Error generating presigned URLs', {
      error: err instanceof Error ? err.message : String(err),
    });
    return error('Error al generar URLs de subida');
  }
};
