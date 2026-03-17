import { LotesService } from '../services/lotes';
import { EventosService } from '../services/eventos';
import { logger } from '../shared/logger';

const lotesService = new LotesService();
const eventosService = new EventosService();

export const handler = async (): Promise<void> => {
  const openLotes = await lotesService.findByEstado('abierto');

  if (openLotes.length === 0) {
    logger.info('No open lotes to process');
    return;
  }

  const isCutoff = lotesService.shouldCloseByCutoff();
  let closedCount = 0;

  for (const lote of openLotes) {
    let razon: string | null = null;

    if (isCutoff && lote.remitos_count > 0) {
      razon = 'corte_horario';
    } else if (lotesService.shouldCloseByInactivity(lote)) {
      razon = 'inactividad';
    }

    if (razon) {
      try {
        await lotesService.cerrar(lote.lote_id);
        await eventosService.registrar({
          entidadId: lote.lote_id,
          tipo: 'lote_cerrado',
          loteId: lote.lote_id,
          metadata: { razon, remitos_count: lote.remitos_count },
        });
        closedCount++;
        logger.info('Lote closed', {
          loteId: lote.lote_id,
          razon,
          remitosCount: lote.remitos_count,
        });
      } catch (err) {
        logger.error('Error closing lote', {
          loteId: lote.lote_id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  logger.info('Close lotes job completed', {
    openLotes: openLotes.length,
    closed: closedCount,
    isCutoff,
  });
};
