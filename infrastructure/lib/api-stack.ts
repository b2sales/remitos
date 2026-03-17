import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as path from 'path';
import { Construct } from 'constructs';

interface ApiStackProps extends cdk.StackProps {
  remitosTable: dynamodb.ITable;
  lotesTable: dynamodb.ITable;
  operadoresTable: dynamodb.ITable;
  eventosTable: dynamodb.ITable;
  imagesBucket: s3.IBucket;
  azureTenantId: string;
  azureClientId: string;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const backendRoot = path.join(__dirname, '..', '..', 'backend');

    const sharedEnv: Record<string, string> = {
      REMITOS_TABLE: props.remitosTable.tableName,
      LOTES_TABLE: props.lotesTable.tableName,
      OPERADORES_TABLE: props.operadoresTable.tableName,
      EVENTOS_TABLE: props.eventosTable.tableName,
      IMAGES_BUCKET: props.imagesBucket.bucketName,
      AZURE_TENANT_ID: props.azureTenantId,
      AZURE_CLIENT_ID: props.azureClientId,
    };

    const defaultLambdaProps: lambdaNode.NodejsFunctionProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: sharedEnv,
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    };

    // --- Lambda Authorizer ---
    const authorizerFn = new lambdaNode.NodejsFunction(this, 'AuthorizerFn', {
      ...defaultLambdaProps,
      entry: path.join(backendRoot, 'src', 'functions', 'authorizer.ts'),
      handler: 'handler',
      functionName: 'remitos-authorizer',
      description: 'Validates Azure AD JWT tokens',
    });

    // --- GET /me Lambda ---
    const meFn = new lambdaNode.NodejsFunction(this, 'MeFn', {
      ...defaultLambdaProps,
      entry: path.join(backendRoot, 'src', 'functions', 'me.ts'),
      handler: 'handler',
      functionName: 'remitos-me',
      description: 'Returns current operator profile, auto-registers on first login',
    });

    props.operadoresTable.grantReadWriteData(meFn);

    // --- GET /remitos Lambda ---
    const listRemitosFn = new lambdaNode.NodejsFunction(this, 'ListRemitosFn', {
      ...defaultLambdaProps,
      entry: path.join(backendRoot, 'src', 'functions', 'list-remitos.ts'),
      handler: 'handler',
      functionName: 'remitos-list',
      description: 'Lists remitos by estado with pagination',
    });

    props.remitosTable.grantReadData(listRemitosFn);

    // --- GET /remitos/{remitoId} Lambda ---
    const getRemitoFn = new lambdaNode.NodejsFunction(this, 'GetRemitoFn', {
      ...defaultLambdaProps,
      entry: path.join(backendRoot, 'src', 'functions', 'get-remito.ts'),
      handler: 'handler',
      functionName: 'remitos-get',
      description: 'Gets a single remito with presigned image URL',
    });

    props.remitosTable.grantReadData(getRemitoFn);
    props.imagesBucket.grantRead(getRemitoFn);

    // --- POST /remitos/upload Lambda ---
    const uploadPresignFn = new lambdaNode.NodejsFunction(this, 'UploadPresignFn', {
      ...defaultLambdaProps,
      entry: path.join(backendRoot, 'src', 'functions', 'upload-presign.ts'),
      handler: 'handler',
      functionName: 'remitos-upload-presign',
      description: 'Generates presigned S3 URLs for browser upload',
    });

    props.imagesBucket.grantPut(uploadPresignFn);

    // --- PUT /remitos/{remitoId}/validar Lambda ---
    const validarRemitoFn = new lambdaNode.NodejsFunction(this, 'ValidarRemitoFn', {
      ...defaultLambdaProps,
      entry: path.join(backendRoot, 'src', 'functions', 'validar-remito.ts'),
      handler: 'handler',
      functionName: 'remitos-validar',
      description: 'Validates a remito, assigns to lote, logs events',
    });

    props.remitosTable.grantReadWriteData(validarRemitoFn);
    props.lotesTable.grantReadWriteData(validarRemitoFn);
    props.eventosTable.grantWriteData(validarRemitoFn);

    // --- GET /lotes Lambda ---
    const listLotesFn = new lambdaNode.NodejsFunction(this, 'ListLotesFn', {
      ...defaultLambdaProps,
      entry: path.join(backendRoot, 'src', 'functions', 'list-lotes.ts'),
      handler: 'handler',
      functionName: 'remitos-list-lotes',
      description: 'Lists lotes by estado',
    });

    props.lotesTable.grantReadData(listLotesFn);

    // --- GET /lotes/{loteId} Lambda ---
    const getLoteFn = new lambdaNode.NodejsFunction(this, 'GetLoteFn', {
      ...defaultLambdaProps,
      entry: path.join(backendRoot, 'src', 'functions', 'get-lote.ts'),
      handler: 'handler',
      functionName: 'remitos-get-lote',
      description: 'Gets lote detail with its remitos',
    });

    props.lotesTable.grantReadData(getLoteFn);
    props.remitosTable.grantReadData(getLoteFn);

    // --- GET /remitos/buscar Lambda ---
    const searchRemitosFn = new lambdaNode.NodejsFunction(this, 'SearchRemitosFn', {
      ...defaultLambdaProps,
      entry: path.join(backendRoot, 'src', 'functions', 'search-remitos.ts'),
      handler: 'handler',
      functionName: 'remitos-search',
      description: 'Searches remitos by remitente/destinatario/id',
    });

    props.remitosTable.grantReadData(searchRemitosFn);

    // --- POST /remitos/urgentes Lambda ---
    const createUrgenteFn = new lambdaNode.NodejsFunction(this, 'CreateUrgenteFn', {
      ...defaultLambdaProps,
      entry: path.join(backendRoot, 'src', 'functions', 'create-urgente.ts'),
      handler: 'handler',
      functionName: 'remitos-create-urgente',
      description: 'Creates urgent lote from selected remitos',
    });

    props.remitosTable.grantReadWriteData(createUrgenteFn);
    props.lotesTable.grantReadWriteData(createUrgenteFn);
    props.eventosTable.grantWriteData(createUrgenteFn);

    // --- POST /lotes/{loteId}/guia Lambda ---
    const generarGuiaFn = new lambdaNode.NodejsFunction(this, 'GenerarGuiaFn', {
      ...defaultLambdaProps,
      entry: path.join(backendRoot, 'src', 'functions', 'generar-guia.ts'),
      handler: 'handler',
      functionName: 'remitos-generar-guia',
      description: 'Generates Acmasoft guia from validated lote',
    });

    props.lotesTable.grantReadWriteData(generarGuiaFn);
    props.remitosTable.grantReadWriteData(generarGuiaFn);
    props.eventosTable.grantWriteData(generarGuiaFn);

    // --- GET /clientes/buscar Lambda ---
    const buscarClientesFn = new lambdaNode.NodejsFunction(this, 'BuscarClientesFn', {
      ...defaultLambdaProps,
      entry: path.join(backendRoot, 'src', 'functions', 'buscar-clientes.ts'),
      handler: 'handler',
      functionName: 'remitos-buscar-clientes',
      description: 'Searches Acmasoft clients by name/CUIT',
    });

    // --- GET /stats Lambda ---
    const statsFn = new lambdaNode.NodejsFunction(this, 'StatsFn', {
      ...defaultLambdaProps,
      entry: path.join(backendRoot, 'src', 'functions', 'stats.ts'),
      handler: 'handler',
      functionName: 'remitos-stats',
      description: 'Computes real-time dashboard KPIs',
      timeout: cdk.Duration.seconds(30),
    });

    props.remitosTable.grantReadData(statsFn);
    props.lotesTable.grantReadData(statsFn);
    props.eventosTable.grantReadData(statsFn);

    // --- Scheduled Lambda: Close lotes ---
    const closeLotesFn = new lambdaNode.NodejsFunction(this, 'CloseLotesFn', {
      ...defaultLambdaProps,
      entry: path.join(backendRoot, 'src', 'functions', 'close-lotes.ts'),
      handler: 'handler',
      functionName: 'remitos-close-lotes',
      description: 'Closes lotes by inactivity or cutoff schedule',
      timeout: cdk.Duration.seconds(60),
    });

    props.lotesTable.grantReadWriteData(closeLotesFn);
    props.eventosTable.grantWriteData(closeLotesFn);

    new events.Rule(this, 'CloseLotesSchedule', {
      ruleName: 'remitos-close-lotes-schedule',
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new eventsTargets.LambdaFunction(closeLotesFn)],
    });

    // --- API Gateway ---
    this.api = new apigateway.RestApi(this, 'RemitosApi', {
      restApiName: 'Remitos API',
      description: 'API para el sistema de remitos',
      deployOptions: {
        stageName: 'api',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // Gateway Responses: add CORS headers to error responses (authorizer rejections, etc.)
    const corsResponseHeaders: Record<string, string> = {
      'method.response.header.Access-Control-Allow-Origin': "'*'",
      'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization'",
      'method.response.header.Access-Control-Allow-Methods': "'GET,POST,PUT,PATCH,DELETE,OPTIONS'",
    };

    this.api.addGatewayResponse('Unauthorized', {
      type: apigateway.ResponseType.UNAUTHORIZED,
      responseHeaders: corsResponseHeaders,
      templates: { 'application/json': '{"error":"Unauthorized"}' },
    });

    this.api.addGatewayResponse('AccessDenied', {
      type: apigateway.ResponseType.ACCESS_DENIED,
      responseHeaders: corsResponseHeaders,
      templates: { 'application/json': '{"error":"Access denied"}' },
    });

    this.api.addGatewayResponse('Default4XX', {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: corsResponseHeaders,
    });

    this.api.addGatewayResponse('Default5XX', {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: corsResponseHeaders,
    });

    const tokenAuthorizer = new apigateway.TokenAuthorizer(this, 'AzureAdAuthorizer', {
      handler: authorizerFn,
      identitySource: 'method.request.header.Authorization',
      resultsCacheTtl: cdk.Duration.minutes(5),
    });

    const authOpts = { authorizer: tokenAuthorizer };

    // --- Routes ---
    const meResource = this.api.root.addResource('me');
    meResource.addMethod('GET', new apigateway.LambdaIntegration(meFn), authOpts);

    const remitosResource = this.api.root.addResource('remitos');
    remitosResource.addMethod('GET', new apigateway.LambdaIntegration(listRemitosFn), authOpts);

    const uploadResource = remitosResource.addResource('upload');
    uploadResource.addMethod('POST', new apigateway.LambdaIntegration(uploadPresignFn), authOpts);

    const buscarResource = remitosResource.addResource('buscar');
    buscarResource.addMethod('GET', new apigateway.LambdaIntegration(searchRemitosFn), authOpts);

    const urgentesResource = remitosResource.addResource('urgentes');
    urgentesResource.addMethod('POST', new apigateway.LambdaIntegration(createUrgenteFn), authOpts);

    const remitoResource = remitosResource.addResource('{remitoId}');
    remitoResource.addMethod('GET', new apigateway.LambdaIntegration(getRemitoFn), authOpts);

    const validarResource = remitoResource.addResource('validar');
    validarResource.addMethod('PUT', new apigateway.LambdaIntegration(validarRemitoFn), authOpts);

    const lotesResource = this.api.root.addResource('lotes');
    lotesResource.addMethod('GET', new apigateway.LambdaIntegration(listLotesFn), authOpts);

    const loteResource = lotesResource.addResource('{loteId}');
    loteResource.addMethod('GET', new apigateway.LambdaIntegration(getLoteFn), authOpts);

    const guiaResource = loteResource.addResource('guia');
    guiaResource.addMethod('POST', new apigateway.LambdaIntegration(generarGuiaFn), authOpts);

    const statsResource = this.api.root.addResource('stats');
    statsResource.addMethod('GET', new apigateway.LambdaIntegration(statsFn), authOpts);

    const clientesResource = this.api.root.addResource('clientes');
    const buscarClientesResource = clientesResource.addResource('buscar');
    buscarClientesResource.addMethod('GET', new apigateway.LambdaIntegration(buscarClientesFn), authOpts);

    // --- Outputs ---
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      exportName: 'RemitosApiUrl',
    });
  }
}
