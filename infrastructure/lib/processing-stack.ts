import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as path from 'path';
import { Construct } from 'constructs';

interface ProcessingStackProps extends cdk.StackProps {
  imagesBucketName: string;
  remitosTableName: string;
  remitosTableArn: string;
}

export class ProcessingStack extends cdk.Stack {
  public readonly bedrockQueue: sqs.Queue;
  public readonly bedrockDlq: sqs.Queue;

  constructor(scope: Construct, id: string, props: ProcessingStackProps) {
    super(scope, id, props);

    const backendRoot = path.join(__dirname, '..', '..', 'backend');

    // --- SNS topic for Textract completion notifications ---
    const textractTopic = new sns.Topic(this, 'TextractCompletionTopic', {
      topicName: 'remitos-textract-completion',
    });

    // --- IAM Role for Textract to publish to SNS ---
    const textractRole = new iam.Role(this, 'TextractSnsRole', {
      assumedBy: new iam.ServicePrincipal('textract.amazonaws.com'),
    });
    textractTopic.grantPublish(textractRole);

    // --- SQS: Bedrock processing queue + DLQ ---
    this.bedrockDlq = new sqs.Queue(this, 'BedrockDLQ', {
      queueName: 'remitos-bedrock-dlq',
      retentionPeriod: cdk.Duration.days(14),
    });

    this.bedrockQueue = new sqs.Queue(this, 'BedrockQueue', {
      queueName: 'remitos-bedrock-queue',
      visibilityTimeout: cdk.Duration.minutes(5),
      deadLetterQueue: {
        queue: this.bedrockDlq,
        maxReceiveCount: 3,
      },
    });

    // --- IAM user for the scanning PC ---
    const scannerUser = new iam.User(this, 'ScannerUser', {
      userName: 'remitos-scanner',
    });

    scannerUser.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutObject'],
        resources: [`arn:aws:s3:::${props.imagesBucketName}/uploads/*`],
      }),
    );

    const scannerAccessKey = new iam.AccessKey(this, 'ScannerAccessKey', {
      user: scannerUser,
    });

    // --- Lambda: Start Textract on S3 upload ---
    const startTextractFn = new lambdaNode.NodejsFunction(this, 'StartTextractFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(backendRoot, 'src', 'functions', 'start-textract.ts'),
      handler: 'handler',
      functionName: 'remitos-start-textract',
      description: 'Triggered by S3 upload via EventBridge, creates remito and starts Textract OCR',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        REMITOS_TABLE: props.remitosTableName,
        TEXTRACT_SNS_TOPIC_ARN: textractTopic.topicArn,
        TEXTRACT_ROLE_ARN: textractRole.roleArn,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    startTextractFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:PutItem'],
        resources: [props.remitosTableArn],
      }),
    );

    startTextractFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [`arn:aws:s3:::${props.imagesBucketName}/*`],
      }),
    );

    startTextractFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['textract:StartDocumentTextDetection'],
        resources: ['*'],
      }),
    );

    startTextractFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [textractRole.roleArn],
      }),
    );

    // --- EventBridge rule: S3 Object Created → Start Textract ---
    new events.Rule(this, 'S3UploadRule', {
      ruleName: 'remitos-s3-upload-trigger',
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: { name: [props.imagesBucketName] },
          object: { key: [{ prefix: 'uploads/' }] },
        },
      },
      targets: [new eventsTargets.LambdaFunction(startTextractFn)],
    });

    // --- Lambda: Process Textract result ---
    const processResultFn = new lambdaNode.NodejsFunction(this, 'ProcessTextractResultFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(backendRoot, 'src', 'functions', 'process-textract-result.ts'),
      handler: 'handler',
      functionName: 'remitos-process-textract-result',
      description: 'Processes Textract OCR results and enqueues for Bedrock',
      timeout: cdk.Duration.minutes(2),
      memorySize: 512,
      environment: {
        REMITOS_TABLE: props.remitosTableName,
        BEDROCK_QUEUE_URL: this.bedrockQueue.queueUrl,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    processResultFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:GetItem', 'dynamodb:UpdateItem'],
        resources: [props.remitosTableArn],
      }),
    );

    this.bedrockQueue.grantSendMessages(processResultFn);

    processResultFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['textract:GetDocumentTextDetection'],
        resources: ['*'],
      }),
    );

    textractTopic.addSubscription(
      new snsSubscriptions.LambdaSubscription(processResultFn),
    );

    // --- Lambda: Process Bedrock IA ---
    const bedrockFn = new lambdaNode.NodejsFunction(this, 'ProcessBedrockFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(backendRoot, 'src', 'functions', 'process-bedrock.ts'),
      handler: 'handler',
      functionName: 'remitos-process-bedrock',
      description: 'Consumes SQS, calls Bedrock Claude 3.5 Haiku for remito interpretation',
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      environment: {
        REMITOS_TABLE: props.remitosTableName,
        BEDROCK_MODEL_ID: 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    bedrockFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:GetItem', 'dynamodb:UpdateItem'],
        resources: [props.remitosTableArn],
      }),
    );

    bedrockFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-haiku-20241022-v1:0`,
          `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/us.anthropic.claude-3-5-haiku-20241022-v1:0`,
        ],
      }),
    );

    bedrockFn.addEventSource(
      new lambdaEventSources.SqsEventSource(this.bedrockQueue, {
        batchSize: 1,
      }),
    );

    // --- Outputs ---
    new cdk.CfnOutput(this, 'TextractTopicArn', {
      value: textractTopic.topicArn,
    });

    new cdk.CfnOutput(this, 'BedrockQueueUrl', {
      value: this.bedrockQueue.queueUrl,
    });

    new cdk.CfnOutput(this, 'ScannerAccessKeyId', {
      value: scannerAccessKey.accessKeyId,
    });

    new cdk.CfnOutput(this, 'ScannerSecretAccessKey', {
      value: scannerAccessKey.secretAccessKey.unsafeUnwrap(),
    });

    new cdk.CfnOutput(this, 'UploadBucketName', {
      value: props.imagesBucketName,
    });
  }
}
