import type {
  APIGatewayTokenAuthorizerEvent,
  APIGatewayAuthorizerResult,
} from 'aws-lambda';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { env } from '../shared/env';
import { logger } from '../shared/logger';

const ISSUER_V2 = `https://login.microsoftonline.com/${env.AZURE_TENANT_ID}/v2.0`;
const ISSUER_V1 = `https://sts.windows.net/${env.AZURE_TENANT_ID}/`;
const JWKS_URI = `https://login.microsoftonline.com/${env.AZURE_TENANT_ID}/discovery/v2.0/keys`;

const client = jwksClient({
  jwksUri: JWKS_URI,
  cache: true,
  cacheMaxAge: 600_000,
});

function getSigningKey(kid: string): Promise<string> {
  return new Promise((resolve, reject) => {
    client.getSigningKey(kid, (err, key) => {
      if (err || !key) {
        reject(err ?? new Error('Signing key not found'));
        return;
      }
      resolve(key.getPublicKey());
    });
  });
}

interface AzureJwtPayload extends jwt.JwtPayload {
  oid?: string;
  preferred_username?: string;
  name?: string;
  roles?: string[];
}

function buildPolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  context?: Record<string, string | boolean>,
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
    context,
  };
}

function toWildcardArn(methodArn: string): string {
  const parts = methodArn.split(':');
  const apiGatewayPart = parts[5].split('/');
  return `${parts.slice(0, 5).join(':')}:${apiGatewayPart[0]}/${apiGatewayPart[1]}/*`;
}

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent,
): Promise<APIGatewayAuthorizerResult> => {
  const token = event.authorizationToken?.replace(/^Bearer\s+/i, '');
  const wildcardArn = toWildcardArn(event.methodArn);

  if (!token) {
    logger.warn('No token provided');
    return buildPolicy('anonymous', 'Deny', wildcardArn);
  }

  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded?.header?.kid) {
      throw new Error('Token missing kid header');
    }

    const signingKey = await getSigningKey(decoded.header.kid);

    const payload = jwt.verify(token, signingKey, {
      algorithms: ['RS256'],
      issuer: [ISSUER_V2, ISSUER_V1],
      audience: [`api://${env.AZURE_CLIENT_ID}`, env.AZURE_CLIENT_ID],
    }) as AzureJwtPayload;

    const principalId = payload.oid ?? payload.sub ?? 'unknown';

    logger.info('Token validated', { principalId, name: payload.name });

    const roles = payload.roles ?? [];
    const rol = roles.includes('SUPERVISOR') ? 'SUPERVISOR' : 'OPERADOR';

    return buildPolicy(principalId, 'Allow', wildcardArn, {
      azure_oid: principalId,
      email: payload.preferred_username ?? '',
      name: payload.name ?? '',
      rol,
    });
  } catch (err) {
    logger.error('Token validation failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return buildPolicy('anonymous', 'Deny', wildcardArn);
  }
};
