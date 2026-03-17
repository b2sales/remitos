import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { LotesService } from '../services/lotes';
import { RemitosService } from '../services/remitos';
import { EventosService } from '../services/eventos';
import { AcmasoftMockService } from '../services/acmasoft-mock';
import type { AcmasoftGuiaPayload } from '../services/acmasoft';
import { success, error } from '../shared/response';
import { logger } from '../shared/logger';

const lotesService = new LotesService();
const remitosService = new RemitosService();
const eventosService = new EventosService();
const acmasoftService = new AcmasoftMockService();

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const loteId = event.pathParameters?.loteId;
    if (!loteId) {
      return error('loteId es requerido', 400);
    }

    const operadorId = event.requestContext.authorizer?.azure_oid;
    if (!operadorId) {
      return error('No autorizado', 401);
    }

    const lote = await lotesService.findById(loteId);
    if (!lote) {
      return error('Lote no encontrado', 404);
    }

    if (lote.estado === 'enviado') {
      return error(`El lote ya fue enviado (guía: ${lote.numero_guia})`, 409);
    }

    if (lote.estado === 'abierto') {
      return error('El lote está abierto, debe cerrarse antes de generar guía', 409);
    }

    const remitos = await remitosService.findByLote(loteId);
    if (remitos.length === 0) {
      return error('El lote no tiene remitos', 400);
    }

    const noValidados = remitos.filter((r) => r.estado !== 'validado');
    if (noValidados.length > 0) {
      return error(
        `Hay ${noValidados.length} remito(s) sin validar en el lote`,
        409,
      );
    }

    let totalBultos = 0;
    let totalPeso = 0;
    const remitentes = new Set<string>();
    const destinatarios = new Set<string>();

    for (const r of remitos) {
      const datos = r.datos_validados ?? r.datos_ia;
      if (datos) {
        if (datos.bultos) totalBultos += datos.bultos;
        if (datos.peso_kg) totalPeso += datos.peso_kg;
        if (datos.remitente) remitentes.add(datos.remitente);
        if (datos.destinatario) destinatarios.add(datos.destinatario);
      }
    }

    const payload: AcmasoftGuiaPayload = {
      cliente_pagador_id: remitos[0].cliente_pagador_id ?? 'PENDIENTE',
      remitente: [...remitentes].join(' | '),
      destinatario: [...destinatarios].join(' | '),
      tipo_carga: remitos[0].datos_validados?.tipo_carga ?? remitos[0].datos_ia?.tipo_carga ?? 'General',
      bultos: totalBultos,
      peso_kg: totalPeso,
      observaciones: `Lote ${loteId} - ${remitos.length} remitos`,
      remitos_ids: remitos.map((r) => r.remito_id),
    };

    const guia = await acmasoftService.generarGuia(payload);

    await lotesService.marcarEnviado(loteId, guia.guia_id, guia.numero_guia);

    for (const r of remitos) {
      await remitosService.updateEstado(r.remito_id, 'enviado_acmasoft', {
        enviado_acmasoft_en: new Date().toISOString(),
        guia_id: guia.guia_id,
      });
    }

    await eventosService.registrar({
      entidadId: loteId,
      tipo: 'guia_generada',
      loteId,
      operadorId,
      metadata: {
        guia_id: guia.guia_id,
        numero_guia: guia.numero_guia,
        remitos_count: remitos.length,
        total_bultos: totalBultos,
        total_peso_kg: totalPeso,
      },
    });

    logger.info('Guia generated', {
      loteId,
      guiaId: guia.guia_id,
      numeroGuia: guia.numero_guia,
      remitosCount: remitos.length,
      operadorId,
    });

    return success({
      message: 'Guía generada correctamente',
      guia_id: guia.guia_id,
      numero_guia: guia.numero_guia,
      fecha_emision: guia.fecha_emision,
      remitos_enviados: remitos.length,
    }, 201);
  } catch (err) {
    logger.error('Error generating guia', {
      error: err instanceof Error ? err.message : String(err),
    });
    return error('Error al generar guía');
  }
};
