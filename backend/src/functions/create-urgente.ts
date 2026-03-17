import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { RemitosService } from '../services/remitos';
import { LotesService } from '../services/lotes';
import { EventosService } from '../services/eventos';
import { success, error } from '../shared/response';
import { logger } from '../shared/logger';

const remitosService = new RemitosService();
const lotesService = new LotesService();
const eventosService = new EventosService();

interface CreateUrgenteBody {
  remito_ids: string[];
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

    const body = JSON.parse(event.body) as CreateUrgenteBody;

    if (!body.remito_ids || body.remito_ids.length === 0) {
      return error('remito_ids es requerido y no puede estar vacío', 400);
    }

    if (body.remito_ids.length > 20) {
      return error('Máximo 20 remitos por lote urgente', 400);
    }

    const remitos = await Promise.all(
      body.remito_ids.map((id) => remitosService.findById(id)),
    );

    const notFound = body.remito_ids.filter((id, i) => !remitos[i]);
    if (notFound.length > 0) {
      return error(`Remitos no encontrados: ${notFound.join(', ')}`, 404);
    }

    const previousLoteIds = new Set<string>();
    for (const remito of remitos) {
      if (remito?.lote_id) {
        previousLoteIds.add(remito.lote_id);
      }
    }

    const loteUrgente = await lotesService.createUrgente(body.remito_ids.length);

    await eventosService.registrar({
      entidadId: loteUrgente.lote_id,
      tipo: 'lote_abierto',
      loteId: loteUrgente.lote_id,
      operadorId,
      metadata: { tipo: 'urgente', remitos_count: body.remito_ids.length },
    });

    for (const remitoId of body.remito_ids) {
      await remitosService.markUrgente(remitoId);
      await remitosService.assignLote(remitoId, loteUrgente.lote_id);

      await eventosService.registrar({
        entidadId: remitoId,
        tipo: 'remito_urgente',
        remitoId,
        loteId: loteUrgente.lote_id,
        operadorId,
      });

      const now = new Date();
      const argHour = ((now.getUTCHours() - 3 + 24) % 24);
      if (argHour < 8 || argHour >= 18) {
        await eventosService.registrar({
          entidadId: remitoId,
          tipo: 'remito_fuera_horario',
          remitoId,
          loteId: loteUrgente.lote_id,
          operadorId,
        });
      }
    }

    await eventosService.registrar({
      entidadId: loteUrgente.lote_id,
      tipo: 'lote_cerrado',
      loteId: loteUrgente.lote_id,
      operadorId,
      metadata: { razon: 'urgente', remitos_count: body.remito_ids.length },
    });

    for (const prevLoteId of previousLoteIds) {
      const prevLote = await lotesService.findById(prevLoteId);
      if (prevLote && prevLote.estado === 'abierto') {
        const remaining = await remitosService.findByLote(prevLoteId);
        if (remaining.length === 0) {
          await lotesService.cerrar(prevLoteId);
        }
      }
    }

    logger.info('Created urgent lote', {
      loteId: loteUrgente.lote_id,
      remitosCount: body.remito_ids.length,
      operadorId,
      previousLotes: [...previousLoteIds],
    });

    return success({
      message: 'Lote urgente creado',
      lote_id: loteUrgente.lote_id,
      remitos_count: body.remito_ids.length,
    }, 201);
  } catch (err) {
    logger.error('Error creating urgent lote', {
      error: err instanceof Error ? err.message : String(err),
    });
    return error('Error al crear lote urgente');
  }
};
