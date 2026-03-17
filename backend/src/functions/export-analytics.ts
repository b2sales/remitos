import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../shared/logger';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

const BUCKET = process.env.ANALYTICS_BUCKET!;
const EVENTOS_TABLE = process.env.EVENTOS_TABLE!;
const REMITOS_TABLE = process.env.REMITOS_TABLE!;
const LOTES_TABLE = process.env.LOTES_TABLE!;

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(fields: unknown[]): string {
  return fields.map(escapeCsv).join(',');
}

async function scanAll(tableName: string): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await dynamo.send(
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

async function exportEventos(): Promise<number> {
  const items = await scanAll(EVENTOS_TABLE);
  const header = 'entidad_id,timestamp_evento_id,tipo_evento,remito_id,lote_id,operador_id,timestamp,metadata_json';

  const rows = items.map((item) => {
    const ts = typeof item.timestamp_evento_id === 'string'
      ? item.timestamp_evento_id.split('#')[0]
      : '';
    return toCsvRow([
      item.entidad_id,
      item.timestamp_evento_id,
      item.tipo_evento,
      item.remito_id,
      item.lote_id,
      item.operador_id,
      ts,
      item.metadata ? JSON.stringify(item.metadata) : '',
    ]);
  });

  const csv = [header, ...rows].join('\n');
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: 'exports/eventos/data.csv',
    Body: csv,
    ContentType: 'text/csv',
  }));

  return items.length;
}

async function exportRemitos(): Promise<number> {
  const items = await scanAll(REMITOS_TABLE);
  const header = 'remito_id,estado,lote_id,remitente_normalizado,destinatario_normalizado,cliente_pagador_id,operador_id_validacion,es_urgente,fuera_de_horario,escaneado_en,entra_validacion_en,validado_en,enviado_acmasoft_en';

  const rows = items.map((item) =>
    toCsvRow([
      item.remito_id,
      item.estado,
      item.lote_id,
      item.remitente_normalizado,
      item.destinatario_normalizado,
      item.cliente_pagador_id,
      item.operador_id_validacion,
      item.es_urgente,
      item.fuera_de_horario,
      item.escaneado_en,
      item.entra_validacion_en,
      item.validado_en,
      item.enviado_acmasoft_en,
    ]),
  );

  const csv = [header, ...rows].join('\n');
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: 'exports/remitos/data.csv',
    Body: csv,
    ContentType: 'text/csv',
  }));

  return items.length;
}

async function exportLotes(): Promise<number> {
  const items = await scanAll(LOTES_TABLE);
  const header = 'lote_id,tipo,estado,remitos_count,abierto_en,cerrado_en,guia_id,numero_guia,enviado_en';

  const rows = items.map((item) =>
    toCsvRow([
      item.lote_id,
      item.tipo,
      item.estado,
      item.remitos_count,
      item.abierto_en,
      item.cerrado_en,
      item.guia_id,
      item.numero_guia,
      item.enviado_en,
    ]),
  );

  const csv = [header, ...rows].join('\n');
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: 'exports/lotes/data.csv',
    Body: csv,
    ContentType: 'text/csv',
  }));

  return items.length;
}

export const handler = async (): Promise<void> => {
  logger.info('Starting analytics export');

  const [eventosCount, remitosCount, lotesCount] = await Promise.all([
    exportEventos(),
    exportRemitos(),
    exportLotes(),
  ]);

  logger.info('Analytics export complete', {
    eventos: eventosCount,
    remitos: remitosCount,
    lotes: lotesCount,
    bucket: BUCKET,
  });
};
