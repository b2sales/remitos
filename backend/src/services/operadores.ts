import { GetCommand, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
import { docClient } from '../shared/dynamo';
import { env } from '../shared/env';
import type { Operador, OperadorRol } from '../models/operador';

export class OperadoresService {
  /**
   * Finds an operator by their Azure AD Object ID.
   * Returns null if not found.
   */
  async findByAzureOid(azureObjectId: string): Promise<Operador | null> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: env.OPERADORES_TABLE,
        IndexName: 'GSI1-azure',
        KeyConditionExpression: 'azure_object_id = :oid',
        ExpressionAttributeValues: { ':oid': azureObjectId },
        Limit: 1,
      }),
    );
    return (result.Items?.[0] as Operador) ?? null;
  }

  /**
   * Finds an operator by their internal ID.
   */
  async findById(operadorId: string): Promise<Operador | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: env.OPERADORES_TABLE,
        Key: { operador_id: operadorId },
      }),
    );
    return (result.Item as Operador) ?? null;
  }

  /**
   * Registers a new operator on first login.
   * Defaults to OPERADOR role.
   */
  async register(params: {
    azureObjectId: string;
    nombre: string;
    email: string;
    rol?: OperadorRol;
  }): Promise<Operador> {
    const now = new Date().toISOString();
    const operador: Operador = {
      operador_id: randomUUID(),
      azure_object_id: params.azureObjectId,
      nombre: params.nombre,
      email: params.email,
      rol: params.rol ?? 'OPERADOR',
      creado_en: now,
      ultima_actividad: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: env.OPERADORES_TABLE,
        Item: operador,
        ConditionExpression: 'attribute_not_exists(operador_id)',
      }),
    );

    return operador;
  }

  /**
   * Syncs activity timestamp and role from the Azure AD token.
   * If the role changed in Azure AD, it gets updated here.
   */
  async syncFromToken(operadorId: string, rol: OperadorRol): Promise<void> {
    await docClient.send(
      new UpdateCommand({
        TableName: env.OPERADORES_TABLE,
        Key: { operador_id: operadorId },
        UpdateExpression: 'SET ultima_actividad = :now, rol = :rol',
        ExpressionAttributeValues: {
          ':now': new Date().toISOString(),
          ':rol': rol,
        },
      }),
    );
  }

  /**
   * Finds or creates an operator based on Azure AD claims.
   * Syncs the role from the token on every login so changes
   * in Azure AD App Roles are reflected immediately.
   */
  async findOrCreate(params: {
    azureObjectId: string;
    nombre: string;
    email: string;
    rol?: OperadorRol;
  }): Promise<Operador> {
    const rol = params.rol ?? 'OPERADOR';
    const existing = await this.findByAzureOid(params.azureObjectId);
    if (existing) {
      await this.syncFromToken(existing.operador_id, rol);
      return { ...existing, rol, ultima_actividad: new Date().toISOString() };
    }
    return this.register({ ...params, rol });
  }
}
