import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class StorageStack extends cdk.Stack {
  public readonly remitosTable: dynamodb.Table;
  public readonly lotesTable: dynamodb.Table;
  public readonly operadoresTable: dynamodb.Table;
  public readonly eventosTable: dynamodb.Table;
  public readonly imagesBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- S3 Bucket for scanned remito images ---
    this.imagesBucket = new s3.Bucket(this, 'RemitosImagesBucket', {
      bucketName: cdk.PhysicalName.GENERATE_IF_NEEDED,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      eventBridgeEnabled: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: 'tiered-storage',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(90),
            },
            {
              storageClass: s3.StorageClass.GLACIER_INSTANT_RETRIEVAL,
              transitionAfter: cdk.Duration.days(365),
            },
          ],
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: ['*'], // restrict in production
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
    });

    // --- DynamoDB: Remitos ---
    this.remitosTable = new dynamodb.Table(this, 'RemitosTable', {
      tableName: 'Remitos',
      partitionKey: { name: 'remito_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    this.remitosTable.addGlobalSecondaryIndex({
      indexName: 'GSI1-lote',
      partitionKey: { name: 'lote_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'escaneado_en', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.remitosTable.addGlobalSecondaryIndex({
      indexName: 'GSI2-estado',
      partitionKey: { name: 'estado', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'escaneado_en', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.remitosTable.addGlobalSecondaryIndex({
      indexName: 'GSI3-operador',
      partitionKey: {
        name: 'operador_id_validacion',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: { name: 'validado_en', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // --- DynamoDB: Lotes ---
    this.lotesTable = new dynamodb.Table(this, 'LotesTable', {
      tableName: 'Lotes',
      partitionKey: { name: 'lote_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    this.lotesTable.addGlobalSecondaryIndex({
      indexName: 'GSI1-estado',
      partitionKey: { name: 'estado', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'abierto_en', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // --- DynamoDB: Operadores ---
    this.operadoresTable = new dynamodb.Table(this, 'OperadoresTable', {
      tableName: 'Operadores',
      partitionKey: { name: 'operador_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.operadoresTable.addGlobalSecondaryIndex({
      indexName: 'GSI1-azure',
      partitionKey: { name: 'azure_object_id', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // --- DynamoDB: Eventos ---
    this.eventosTable = new dynamodb.Table(this, 'EventosTable', {
      tableName: 'Eventos',
      partitionKey: { name: 'entidad_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp_evento_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    this.eventosTable.addGlobalSecondaryIndex({
      indexName: 'GSI1-tipo',
      partitionKey: { name: 'tipo_evento', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp_evento_id', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.eventosTable.addGlobalSecondaryIndex({
      indexName: 'GSI2-operador',
      partitionKey: { name: 'operador_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp_evento_id', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // --- Outputs ---
    new cdk.CfnOutput(this, 'ImagesBucketName', {
      value: this.imagesBucket.bucketName,
      exportName: 'RemitosImagesBucketName',
    });

    new cdk.CfnOutput(this, 'RemitosTableName', {
      value: this.remitosTable.tableName,
      exportName: 'RemitosTableName',
    });

    new cdk.CfnOutput(this, 'LotesTableName', {
      value: this.lotesTable.tableName,
      exportName: 'LotesTableName',
    });

    new cdk.CfnOutput(this, 'OperadoresTableName', {
      value: this.operadoresTable.tableName,
      exportName: 'OperadoresTableName',
    });

    new cdk.CfnOutput(this, 'EventosTableName', {
      value: this.eventosTable.tableName,
      exportName: 'EventosTableName',
    });
  }
}
