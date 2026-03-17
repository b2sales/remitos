import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { OperadoresService } from '../services/operadores';
import { success, error } from '../shared/response';
import { logger } from '../shared/logger';

const operadoresService = new OperadoresService();

/**
 * GET /me — Returns the current operator's profile.
 * Auto-registers on first login using Azure AD claims from the authorizer context.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const ctx = event.requestContext.authorizer;
    if (!ctx?.azure_oid) {
      return error('Unauthorized', 401);
    }

    const operador = await operadoresService.findOrCreate({
      azureObjectId: ctx.azure_oid,
      nombre: ctx.name ?? '',
      email: ctx.email ?? '',
      rol: ctx.rol === 'SUPERVISOR' ? 'SUPERVISOR' : 'OPERADOR',
    });

    logger.info('Operator profile retrieved', {
      operador_id: operador.operador_id,
      rol: operador.rol,
    });

    return success(operador);
  } catch (err) {
    logger.error('Failed to get operator profile', {
      error: err instanceof Error ? err.message : String(err),
    });
    return error('Internal server error');
  }
};
