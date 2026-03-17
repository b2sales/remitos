import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { RemitosService } from '../services/remitos';
import { LotesService } from '../services/lotes';
import { EventosService } from '../services/eventos';
import { success, error } from '../shared/response';
import { logger } from '../shared/logger';

const remitosService = new RemitosService();
const lotesService = new LotesService();
const eventosService = new EventosService();

interface ValidarBody {
  remitente: string;
  destinatario: string;
  tipo_carga: string;
  unidades?: number;
  bultos?: number;
  peso_kg?: number;
  volumen_m3?: number;
  observaciones?: string;
  campos_corregidos: string[];
}

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const remitoId = event.pathParameters?.remitoId;
    if (!remitoId) {
      return error('remitoId es requerido', 400);
    }

    const operadorId = event.requestContext.authorizer?.azure_oid;
    if (!operadorId) {
      return error('No autorizado', 401);
    }

    if (!event.body) {
      return error('Body es requerido', 400);
    }

    const body = JSON.parse(event.body) as ValidarBody;

    if (!body.remitente || !body.destinatario) {
      return error('remitente y destinatario son requeridos', 400);
    }

    const remito = await remitosService.findById(remitoId);
    if (!remito) {
      return error('Remito no encontrado', 404);
    }

    if (remito.estado !== 'pendiente_validacion') {
      return error(`El remito no está pendiente de validación (estado: ${remito.estado})`, 409);
    }

    await remitosService.validar(remitoId, operadorId, {
      remitente: body.remitente,
      destinatario: body.destinatario,
      tipo_carga: body.tipo_carga,
      unidades: body.unidades,
      bultos: body.bultos,
      peso_kg: body.peso_kg,
      volumen_m3: body.volumen_m3,
      observaciones: body.observaciones,
      campos_corregidos: body.campos_corregidos ?? [],
    });

    const { lote, created, closed } = await lotesService.assignRemitoToLote(remitoId);
    await remitosService.assignLote(remitoId, lote.lote_id);

    if (created) {
      await eventosService.registrar({
        entidadId: lote.lote_id,
        tipo: 'lote_abierto',
        loteId: lote.lote_id,
      });
    }

    await eventosService.registrar({
      entidadId: remitoId,
      tipo: 'remito_validado',
      remitoId,
      loteId: lote.lote_id,
      operadorId,
    });

    await eventosService.registrar({
      entidadId: remitoId,
      tipo: 'remito_asignado',
      remitoId,
      loteId: lote.lote_id,
    });

    for (const campo of body.campos_corregidos ?? []) {
      await eventosService.registrar({
        entidadId: remitoId,
        tipo: 'campo_corregido',
        remitoId,
        operadorId,
        metadata: { campo },
      });
    }

    if (closed) {
      await eventosService.registrar({
        entidadId: lote.lote_id,
        tipo: 'lote_cerrado',
        loteId: lote.lote_id,
        metadata: { razon: 'max_remitos' },
      });
    }

    logger.info('Remito validated and assigned to lote', {
      remitoId,
      operadorId,
      loteId: lote.lote_id,
      loteCreated: created,
      loteClosed: closed,
      camposCorregidos: body.campos_corregidos,
    });

    return success({
      message: 'Remito validado correctamente',
      lote_id: lote.lote_id,
      lote_created: created,
      lote_closed: closed,
    });
  } catch (err) {
    logger.error('Error validating remito', {
      error: err instanceof Error ? err.message : String(err),
    });
    return error('Error al validar remito');
  }
};
