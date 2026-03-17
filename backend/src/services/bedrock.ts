import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import type { DatosIA } from '../models/remito';
import { buildPrompt } from '../prompts/interpretar-remito';
import { logger } from '../shared/logger';

const client = new BedrockRuntimeClient({});

const DEFAULT_MODEL_ID = 'us.anthropic.claude-3-5-haiku-20241022-v1:0';

interface ClaudeResponse {
  content: Array<{ type: string; text: string }>;
  usage: { input_tokens: number; output_tokens: number };
}

export class BedrockService {
  private modelId: string;

  constructor(modelId?: string) {
    this.modelId = modelId ?? process.env.BEDROCK_MODEL_ID ?? DEFAULT_MODEL_ID;
  }

  /**
   * Sends the OCR text to Claude and returns structured interpretation.
   * Throws if Bedrock fails or the response can't be parsed as DatosIA.
   */
  async interpretarRemito(textoOcr: string): Promise<DatosIA> {
    const prompt = buildPrompt(textoOcr);

    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      messages: [
        { role: 'user', content: prompt },
      ],
    });

    const response = await client.send(
      new InvokeModelCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: Buffer.from(body),
      }),
    );

    const responseBody = JSON.parse(
      new TextDecoder().decode(response.body),
    ) as ClaudeResponse;

    const text = responseBody.content?.[0]?.text;
    if (!text) {
      throw new Error('Empty response from Bedrock');
    }

    logger.info('Bedrock response received', {
      input_tokens: responseBody.usage?.input_tokens,
      output_tokens: responseBody.usage?.output_tokens,
      model: this.modelId,
    });

    return this.parseResponse(text);
  }

  /**
   * Parses Claude's JSON response into a typed DatosIA object.
   * Handles cases where Claude wraps JSON in markdown code blocks.
   */
  private parseResponse(text: string): DatosIA {
    let cleaned = text.trim();

    // Strip markdown code block if Claude includes it despite instructions
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(cleaned);

    return {
      remitente: String(parsed.remitente ?? ''),
      destinatario: String(parsed.destinatario ?? ''),
      tipo_carga: String(parsed.tipo_carga ?? ''),
      unidades: parsed.unidades ?? undefined,
      bultos: parsed.bultos ?? undefined,
      peso_kg: parsed.peso_kg ?? undefined,
      volumen_m3: parsed.volumen_m3 ?? undefined,
      observaciones: parsed.observaciones ?? undefined,
      confianza: parsed.confianza ?? {},
    };
  }
}
