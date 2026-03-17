import { TextractClient, StartDocumentTextDetectionCommand } from '@aws-sdk/client-textract';
import { RemitosService } from '../services/remitos';
import { logger } from '../shared/logger';

const textract = new TextractClient({});
const remitosService = new RemitosService();

const SNS_TOPIC_ARN = process.env.TEXTRACT_SNS_TOPIC_ARN ?? '';
const TEXTRACT_ROLE_ARN = process.env.TEXTRACT_ROLE_ARN ?? '';

interface EventBridgeS3Event {
  detail: {
    bucket: { name: string };
    object: { key: string; size: number };
  };
}

/**
 * Triggered by EventBridge when a new file is uploaded to S3 uploads/ prefix.
 * Creates a remito record and starts async Textract OCR.
 */
export const handler = async (event: EventBridgeS3Event): Promise<void> => {
  const bucket = event.detail.bucket.name;
  const key = decodeURIComponent(event.detail.object.key.replace(/\+/g, ' '));

  logger.info('New file uploaded', { bucket, key });

  try {
    const remito = await remitosService.create(key);

    await textract.send(
      new StartDocumentTextDetectionCommand({
        DocumentLocation: {
          S3Object: { Bucket: bucket, Name: key },
        },
        NotificationChannel: {
          SNSTopicArn: SNS_TOPIC_ARN,
          RoleArn: TEXTRACT_ROLE_ARN,
        },
        ClientRequestToken: remito.remito_id,
        JobTag: remito.remito_id,
      }),
    );

    logger.info('Textract job started', { remito_id: remito.remito_id, key });
  } catch (err) {
    logger.error('Failed to start Textract', {
      key,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
