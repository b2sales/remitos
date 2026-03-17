import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/dynamo';
import { env } from '../shared/env';
import { success, error } from '../shared/response';
import { logger } from '../shared/logger';
import type { Remito } from '../models/remito';

interface OperadorStats {
  operador_id: string;
  remitos_validados: number;
  campos_corregidos: number;
}

export const handler = async (
  _event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const [remitosData, eventosData, lotesData] = await Promise.all([
      scanAll(env.REMITOS_TABLE),
      scanAll(env.EVENTOS_TABLE),
      scanAll(env.LOTES_TABLE),
    ]);

    const remitos = remitosData as Remito[];

    const pendientes = remitos.filter((r) => r.estado === 'pendiente_validacion').length;
    const validados = remitos.filter((r) => r.estado === 'validado' || r.estado === 'enviado_acmasoft').length;
    const enviados = remitos.filter((r) => r.estado === 'enviado_acmasoft').length;
    const errores = remitos.filter((r) => r.estado === 'error_ocr' || r.estado === 'error_ia').length;
    const urgentes = remitos.filter((r) => r.es_urgente).length;
    const fueraHorario = remitos.filter((r) => r.fuera_de_horario).length;

    const correccionesMap = new Map<string, number>();
    const validacionesMap = new Map<string, number>();

    for (const evento of eventosData) {
      const tipo = evento.tipo_evento as string;
      const opId = evento.operador_id as string | undefined;
      if (!opId) continue;

      if (tipo === 'remito_validado') {
        validacionesMap.set(opId, (validacionesMap.get(opId) ?? 0) + 1);
      }
      if (tipo === 'campo_corregido') {
        correccionesMap.set(opId, (correccionesMap.get(opId) ?? 0) + 1);
      }
    }

    const operadorIds = new Set([...validacionesMap.keys(), ...correccionesMap.keys()]);
    const operadores: OperadorStats[] = [...operadorIds].map((id) => ({
      operador_id: id,
      remitos_validados: validacionesMap.get(id) ?? 0,
      campos_corregidos: correccionesMap.get(id) ?? 0,
    }));

    let sinCorreccion = 0;
    let totalLatenciaMs = 0;
    let latenciaCount = 0;

    for (const r of remitos) {
      if (r.estado === 'validado' || r.estado === 'enviado_acmasoft') {
        const validadosEvt = eventosData.filter(
          (e) => e.remito_id === r.remito_id && e.tipo_evento === 'campo_corregido',
        );
        if (validadosEvt.length === 0) sinCorreccion++;
      }

      if (r.escaneado_en && r.validado_en) {
        const diff = new Date(r.validado_en).getTime() - new Date(r.escaneado_en).getTime();
        if (diff > 0) {
          totalLatenciaMs += diff;
          latenciaCount++;
        }
      }
    }

    const pctSinCorreccion = validados > 0 ? Math.round((sinCorreccion / validados) * 100) : 0;
    const latenciaPromedioMin = latenciaCount > 0
      ? Math.round(totalLatenciaMs / latenciaCount / 60000)
      : 0;

    const remitentesErrores = new Map<string, number>();
    for (const evento of eventosData) {
      if (evento.tipo_evento === 'campo_corregido' && evento.remito_id) {
        const remito = remitos.find((r) => r.remito_id === evento.remito_id);
        const remitente = remito?.remitente_normalizado ?? 'Desconocido';
        remitentesErrores.set(remitente, (remitentesErrores.get(remitente) ?? 0) + 1);
      }
    }
    const topRemitentesErrores = [...remitentesErrores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([remitente, correcciones]) => ({ remitente, correcciones }));

    const lotesAbiertos = lotesData.filter((l) => l.estado === 'abierto').length;
    const lotesCerrados = lotesData.filter((l) => l.estado === 'cerrado').length;
    const lotesEnviados = lotesData.filter((l) => l.estado === 'enviado').length;

    logger.info('Stats computed', { total_remitos: remitos.length, total_eventos: eventosData.length });

    return success({
      resumen: {
        total_remitos: remitos.length,
        pendientes,
        validados,
        enviados,
        errores,
        urgentes,
        fuera_horario: fueraHorario,
      },
      calidad: {
        pct_sin_correccion: pctSinCorreccion,
        latencia_promedio_min: latenciaPromedioMin,
      },
      lotes: {
        abiertos: lotesAbiertos,
        cerrados: lotesCerrados,
        enviados: lotesEnviados,
        total: lotesData.length,
      },
      operadores,
      top_remitentes_errores: topRemitentesErrores,
    });
  } catch (err) {
    logger.error('Error computing stats', {
      error: err instanceof Error ? err.message : String(err),
    });
    return error('Error al calcular estadísticas');
  }
};

async function scanAll(tableName: string): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastKey,
      }),
    );
    items.push(...(result.Items as Record<string, unknown>[]) ?? []);
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
}
