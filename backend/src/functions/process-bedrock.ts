import type { SQSEvent } from 'aws-lambda';
import { BedrockService } from '../services/bedrock';
import { RemitosService } from '../services/remitos';
import { AcmasoftMockService } from '../services/acmasoft-mock';
import { logger } from '../shared/logger';

const bedrockService = new BedrockService();
const remitosService = new RemitosService();
const acmasoftService = new AcmasoftMockService();

interface BedrockQueueMessage {
  remito_id: string;
}

/**
 * Triggered by SQS (batch size 1).
 * Reads OCR text from the remito, calls Bedrock for interpretation,
 * matches the remitente against Acmasoft clients, and saves the result.
 */
export const handler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    const { remito_id } = JSON.parse(record.body) as BedrockQueueMessage;

    logger.info('Processing remito with Bedrock', { remito_id });

    try {
      const remito = await remitosService.findById(remito_id);
      if (!remito) {
        logger.error('Remito not found', { remito_id });
        continue;
      }

      if (!remito.datos_extraidos?.texto_crudo) {
        await remitosService.markIaError(remito_id, 'No OCR text available');
        continue;
      }

      const datosIa = await bedrockService.interpretarRemito(
        remito.datos_extraidos.texto_crudo,
      );

      logger.info('Bedrock interpretation complete', {
        remito_id,
        remitente: datosIa.remitente,
        destinatario: datosIa.destinatario,
        confianza_remitente: datosIa.confianza.remitente,
      });

      let matchCliente = null;
      if (datosIa.remitente) {
        const clientes = await acmasoftService.buscarClientes(datosIa.remitente);
        matchCliente = clientes.length > 0 ? clientes[0] : null;

        if (matchCliente) {
          logger.info('Client match found', {
            remito_id,
            cliente_id: matchCliente.cliente_id,
            razon_social: matchCliente.razon_social,
          });
        }
      }

      await remitosService.saveIaResult(remito_id, datosIa, matchCliente);

      logger.info('Remito processed successfully', {
        remito_id,
        estado: 'pendiente_validacion',
      });
    } catch (err) {
      logger.error('Bedrock processing failed', {
        remito_id,
        error: err instanceof Error ? err.message : String(err),
      });

      await remitosService.markIaError(
        remito_id,
        err instanceof Error ? err.message : String(err),
      ).catch((e) => {
        logger.error('Failed to mark IA error', {
          remito_id,
          error: e instanceof Error ? e.message : String(e),
        });
      });

      throw err;
    }
  }
};
