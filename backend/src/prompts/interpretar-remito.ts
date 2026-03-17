/**
 * Prompt template for interpreting scanned remito text via Bedrock.
 * Version 1.0 — baseline prompt for Claude 3.5 Haiku.
 */

export const PROMPT_VERSION = '1.0';

export function buildPrompt(textoOcr: string): string {
  return `Sos un sistema experto en logística y transporte de cargas en Argentina. 
Tu tarea es interpretar el texto extraído por OCR de un remito de transporte escaneado y devolver datos estructurados en JSON.

El texto OCR puede contener errores de reconocimiento. Usá tu conocimiento del dominio para inferir los valores correctos.

Texto OCR del remito:
---
${textoOcr}
---

Respondé ÚNICAMENTE con un objeto JSON válido (sin markdown, sin backticks, sin explicaciones) con esta estructura exacta:

{
  "remitente": "nombre o razón social del remitente/expedidor",
  "destinatario": "nombre o razón social del destinatario/receptor",
  "tipo_carga": "descripción breve del tipo de mercadería o carga",
  "unidades": null,
  "bultos": null,
  "peso_kg": null,
  "volumen_m3": null,
  "observaciones": "cualquier dato relevante adicional (número de remito, fecha, dirección, etc.)",
  "confianza": {
    "remitente": 0.0,
    "destinatario": 0.0,
    "tipo_carga": 0.0,
    "bultos": 0.0,
    "peso_kg": 0.0,
    "volumen_m3": 0.0
  }
}

Reglas:
- Los campos numéricos (unidades, bultos, peso_kg, volumen_m3) deben ser números o null si no se encuentran.
- El campo "confianza" indica tu nivel de certeza para cada campo, de 0.0 (sin información) a 1.0 (seguro).
- Si no podés determinar un campo de texto, usá una cadena vacía "".
- Normalizá nombres de empresas: quitá errores de OCR evidentes, corregí mayúsculas/minúsculas.
- En "observaciones" incluí el número de remito si lo encontrás.`;
}
