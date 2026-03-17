import type { SNSEvent } from 'aws-lambda';
import {
  TextractClient,
  GetDocumentTextDetectionCommand,
} from '@aws-sdk/client-textract';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { RemitosService } from '../services/remitos';
import type { DatosExtraidos } from '../models/remito';
import { logger } from '../shared/logger';

const textract = new TextractClient({});
const sqs = new SQSClient({});
const remitosService = new RemitosService();

const BEDROCK_QUEUE_URL = process.env.BEDROCK_QUEUE_URL ?? '';

interface TextractNotification {
  JobId: string;
  Status: string;
  JobTag: string;
}

/**
 * Triggered by SNS when Textract completes a job.
 * Fetches OCR results, saves to DynamoDB, and enqueues for Bedrock processing.
 */
export const handler = async (event: SNSEvent): Promise<void> => {
  for (const record of event.Records) {
    const notification: TextractNotification = JSON.parse(record.Sns.Message);
    const { JobId, Status, JobTag: remitoId } = notification;

    logger.info('Textract job completed', { JobId, Status, remitoId });

    if (Status !== 'SUCCEEDED') {
      await remitosService.markOcrError(remitoId, `Textract job ${Status}: ${JobId}`);
      logger.error('Textract job failed', { JobId, Status, remitoId });
      continue;
    }

    try {
      const datosExtraidos = await fetchAllPages(JobId);
      await remitosService.saveOcrResult(remitoId, datosExtraidos);

      await sqs.send(
        new SendMessageCommand({
          QueueUrl: BEDROCK_QUEUE_URL,
          MessageBody: JSON.stringify({ remito_id: remitoId }),
        }),
      );

      logger.info('OCR result saved, enqueued for Bedrock', {
        remitoId,
        lines: datosExtraidos.lineas.length,
        confianza: datosExtraidos.confianza_promedio,
      });
    } catch (err) {
      await remitosService.markOcrError(
        remitoId,
        err instanceof Error ? err.message : String(err),
      );
      logger.error('Failed to process Textract result', {
        remitoId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
};

/**
 * Fetches all pages of Textract results (paginated).
 */
async function fetchAllPages(jobId: string): Promise<DatosExtraidos> {
  const lineas: string[] = [];
  let totalConfidence = 0;
  let lineCount = 0;
  let nextToken: string | undefined;

  do {
    const response = await textract.send(
      new GetDocumentTextDetectionCommand({
        JobId: jobId,
        NextToken: nextToken,
      }),
    );

    for (const block of response.Blocks ?? []) {
      if (block.BlockType === 'LINE' && block.Text) {
        lineas.push(block.Text);
        totalConfidence += block.Confidence ?? 0;
        lineCount++;
      }
    }

    nextToken = response.NextToken;
  } while (nextToken);

  return {
    texto_crudo: lineas.join('\n'),
    lineas,
    confianza_promedio: lineCount > 0 ? totalConfidence / lineCount : 0,
  };
}
