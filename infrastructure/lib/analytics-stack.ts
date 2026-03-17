import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as path from 'path';
import { Construct } from 'constructs';

interface AnalyticsStackProps extends cdk.StackProps {
  eventosTableName: string;
  eventosTableArn: string;
  remitosTableName: string;
  remitosTableArn: string;
  lotesTableName: string;
  lotesTableArn: string;
}

export class AnalyticsStack extends cdk.Stack {
  public readonly analyticsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: AnalyticsStackProps) {
    super(scope, id, props);

    this.analyticsBucket = new s3.Bucket(this, 'AnalyticsBucket', {
      bucketName: cdk.PhysicalName.GENERATE_IF_NEEDED,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: 'cleanup-old-exports',
          prefix: 'exports/',
          expiration: cdk.Duration.days(90),
        },
      ],
    });

    const glueDb = new glue.CfnDatabase(this, 'AnalyticsDatabase', {
      catalogId: this.account,
      databaseInput: {
        name: 'remitos_analytics',
        description: 'Analytics database for Remitos system',
      },
    });

    const csvSerdeProperties = {
      'serialization.format': ',',
      'field.delim': ',',
      'skip.header.line.count': '1',
    };

    new glue.CfnTable(this, 'EventosTable', {
      catalogId: this.account,
      databaseName: 'remitos_analytics',
      tableInput: {
        name: 'eventos',
        tableType: 'EXTERNAL_TABLE',
        parameters: { 'skip.header.line.count': '1' },
        storageDescriptor: {
          location: `s3://${this.analyticsBucket.bucketName}/exports/eventos/`,
          inputFormat: 'org.apache.hadoop.mapred.TextInputFormat',
          outputFormat: 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat',
          serdeInfo: {
            serializationLibrary: 'org.apache.hadoop.hive.serde2.OpenCSVSerde',
            parameters: csvSerdeProperties,
          },
          columns: [
            { name: 'entidad_id', type: 'string' },
            { name: 'timestamp_evento_id', type: 'string' },
            { name: 'tipo_evento', type: 'string' },
            { name: 'remito_id', type: 'string' },
            { name: 'lote_id', type: 'string' },
            { name: 'operador_id', type: 'string' },
            { name: 'timestamp', type: 'string' },
            { name: 'metadata_json', type: 'string' },
          ],
        },
      },
    }).addDependency(glueDb);

    new glue.CfnTable(this, 'RemitosAnalyticsTable', {
      catalogId: this.account,
      databaseName: 'remitos_analytics',
      tableInput: {
        name: 'remitos',
        tableType: 'EXTERNAL_TABLE',
        parameters: { 'skip.header.line.count': '1' },
        storageDescriptor: {
          location: `s3://${this.analyticsBucket.bucketName}/exports/remitos/`,
          inputFormat: 'org.apache.hadoop.mapred.TextInputFormat',
          outputFormat: 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat',
          serdeInfo: {
            serializationLibrary: 'org.apache.hadoop.hive.serde2.OpenCSVSerde',
            parameters: csvSerdeProperties,
          },
          columns: [
            { name: 'remito_id', type: 'string' },
            { name: 'estado', type: 'string' },
            { name: 'lote_id', type: 'string' },
            { name: 'remitente_normalizado', type: 'string' },
            { name: 'destinatario_normalizado', type: 'string' },
            { name: 'cliente_pagador_id', type: 'string' },
            { name: 'operador_id_validacion', type: 'string' },
            { name: 'es_urgente', type: 'string' },
            { name: 'fuera_de_horario', type: 'string' },
            { name: 'escaneado_en', type: 'string' },
            { name: 'entra_validacion_en', type: 'string' },
            { name: 'validado_en', type: 'string' },
            { name: 'enviado_acmasoft_en', type: 'string' },
          ],
        },
      },
    }).addDependency(glueDb);

    new glue.CfnTable(this, 'LotesAnalyticsTable', {
      catalogId: this.account,
      databaseName: 'remitos_analytics',
      tableInput: {
        name: 'lotes',
        tableType: 'EXTERNAL_TABLE',
        parameters: { 'skip.header.line.count': '1' },
        storageDescriptor: {
          location: `s3://${this.analyticsBucket.bucketName}/exports/lotes/`,
          inputFormat: 'org.apache.hadoop.mapred.TextInputFormat',
          outputFormat: 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat',
          serdeInfo: {
            serializationLibrary: 'org.apache.hadoop.hive.serde2.OpenCSVSerde',
            parameters: csvSerdeProperties,
          },
          columns: [
            { name: 'lote_id', type: 'string' },
            { name: 'tipo', type: 'string' },
            { name: 'estado', type: 'string' },
            { name: 'remitos_count', type: 'string' },
            { name: 'abierto_en', type: 'string' },
            { name: 'cerrado_en', type: 'string' },
            { name: 'guia_id', type: 'string' },
            { name: 'numero_guia', type: 'string' },
            { name: 'enviado_en', type: 'string' },
          ],
        },
      },
    }).addDependency(glueDb);

    const backendRoot = path.join(__dirname, '..', '..', 'backend');

    const exportFn = new lambdaNode.NodejsFunction(this, 'ExportAnalyticsFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(backendRoot, 'src', 'functions', 'export-analytics.ts'),
      handler: 'handler',
      functionName: 'remitos-export-analytics',
      description: 'Exports DynamoDB tables to S3 CSV for Athena/Power BI',
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        EVENTOS_TABLE: props.eventosTableName,
        REMITOS_TABLE: props.remitosTableName,
        LOTES_TABLE: props.lotesTableName,
        ANALYTICS_BUCKET: this.analyticsBucket.bucketName,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    this.analyticsBucket.grantWrite(exportFn);

    exportFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:Scan'],
        resources: [
          props.eventosTableArn,
          props.remitosTableArn,
          props.lotesTableArn,
        ],
      }),
    );

    new events.Rule(this, 'ExportSchedule', {
      ruleName: 'remitos-export-analytics-schedule',
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      targets: [new eventsTargets.LambdaFunction(exportFn)],
    });

    new cdk.CfnOutput(this, 'AnalyticsBucketName', {
      value: this.analyticsBucket.bucketName,
      exportName: 'RemitosAnalyticsBucketName',
    });

    new cdk.CfnOutput(this, 'GlueDatabaseName', {
      value: 'remitos_analytics',
      exportName: 'RemitosGlueDatabaseName',
    });
  }
}
