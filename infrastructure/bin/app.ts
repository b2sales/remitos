#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StorageStack } from '../lib/storage-stack';
import { ApiStack } from '../lib/api-stack';
import { ProcessingStack } from '../lib/processing-stack';
import { FrontendStack } from '../lib/frontend-stack';
import { AnalyticsStack } from '../lib/analytics-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

const storage = new StorageStack(app, 'RemitosStorageStack', { env });

const api = new ApiStack(app, 'RemitosApiStack', {
  env,
  remitosTable: storage.remitosTable,
  lotesTable: storage.lotesTable,
  operadoresTable: storage.operadoresTable,
  eventosTable: storage.eventosTable,
  imagesBucket: storage.imagesBucket,
  azureTenantId: 'bccd9a6a-3fc9-4a47-b812-132619718ed0',
  azureClientId: '320bab40-6c04-46f7-9eef-001edf91aaab',
});

new ProcessingStack(app, 'RemitosProcessingStack', {
  env,
  imagesBucketName: storage.imagesBucket.bucketName,
  remitosTableName: storage.remitosTable.tableName,
  remitosTableArn: storage.remitosTable.tableArn,
});

new FrontendStack(app, 'RemitosFrontendStack', {
  env,
  apiUrl: api.api.url,
});

new AnalyticsStack(app, 'RemitosAnalyticsStack', {
  env,
  eventosTableName: storage.eventosTable.tableName,
  eventosTableArn: storage.eventosTable.tableArn,
  remitosTableName: storage.remitosTable.tableName,
  remitosTableArn: storage.remitosTable.tableArn,
  lotesTableName: storage.lotesTable.tableName,
  lotesTableArn: storage.lotesTable.tableArn,
});

app.synth();
