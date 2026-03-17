export const env = {
  REMITOS_TABLE: process.env.REMITOS_TABLE ?? 'Remitos',
  LOTES_TABLE: process.env.LOTES_TABLE ?? 'Lotes',
  OPERADORES_TABLE: process.env.OPERADORES_TABLE ?? 'Operadores',
  EVENTOS_TABLE: process.env.EVENTOS_TABLE ?? 'Eventos',
  IMAGES_BUCKET: process.env.IMAGES_BUCKET ?? '',
  AZURE_TENANT_ID: process.env.AZURE_TENANT_ID ?? 'bccd9a6a-3fc9-4a47-b812-132619718ed0',
  AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID ?? '320bab40-6c04-46f7-9eef-001edf91aaab',
} as const;
