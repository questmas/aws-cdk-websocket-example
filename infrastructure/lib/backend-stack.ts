import * as cdk from '@aws-cdk/core';
import apigateway = require("@aws-cdk/aws-apigateway");
import apigatewayv2 = require("@aws-cdk/aws-apigatewayv2");
import apigatewayv2_integrations = require("@aws-cdk/aws-apigatewayv2-integrations");
import lambda = require("@aws-cdk/aws-lambda");
import dynamodb = require("@aws-cdk/aws-dynamodb");
import { IFunction } from '@aws-cdk/aws-lambda';
import { PolicyStatement } from '@aws-cdk/aws-iam';

export class BackendStack extends cdk.Stack {  
  constructor(app: cdk.App, id: string, props?: cdk.StackProps) {
    super(app, id, props);

    const dynamoTable = new dynamodb.Table(this, 'socketConnections', {
      partitionKey: {
        name: 'connectionId',
        type: dynamodb.AttributeType.STRING
      },
      tableName: 'socketConnections',

      // The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
      // the new table, and it will remain in your account until manually deleted. By setting the policy to 
      // DESTROY, cdk destroy will delete the table (even if it has data in it)
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production code
    });

    const onConnectLambda = new lambda.Function(this, 'onConnectFunction', {
      code: new lambda.AssetCode('../backend'),
      handler: 'onconnect.handler',
      runtime: lambda.Runtime.NODEJS_14_X,
    });

    const onDisconnectLambda = new lambda.Function(this, 'onDisconnectFunction', {
      code: new lambda.AssetCode('../backend'),
      handler: 'ondisconnect.handler',
      runtime: lambda.Runtime.NODEJS_14_X,
    });

    const sendMessageLambda = new lambda.Function(this, 'sendMessageFunction', {
      code: new lambda.AssetCode('../backend'),
      handler: 'sendmessage.handler',
      runtime: lambda.Runtime.NODEJS_14_X,
    });
    
    dynamoTable.grantReadWriteData(onConnectLambda);
    dynamoTable.grantReadWriteData(onDisconnectLambda);
    dynamoTable.grantReadData(sendMessageLambda);

    const api = new apigatewayv2.WebSocketApi(this, 'websocketApi', {
      apiName: 'Websocket Service',
      connectRouteOptions: { integration: new apigatewayv2_integrations.LambdaWebSocketIntegration({ handler: onConnectLambda }) },
      disconnectRouteOptions: { integration: new apigatewayv2_integrations.LambdaWebSocketIntegration({ handler: onDisconnectLambda }) },
      defaultRouteOptions: { integration: new apigatewayv2_integrations.LambdaWebSocketIntegration({ handler: sendMessageLambda }) },
    });
    sendMessageLambda.addToRolePolicy(new PolicyStatement({
      actions: ["execute-api:ManageConnections"],
      resources: ["*"]
    }));

    new apigatewayv2.WebSocketStage(this, 'mystage', {
      webSocketApi: api,
      stageName: 'prod',
      autoDeploy: true,
    });

    /*const getAllIntegration = new apigateway.LambdaIntegration(getAllLambda);
    items.addMethod('GET', getAllIntegration);

    const createOneIntegration = new apigateway.LambdaIntegration(createOne);
    items.addMethod('POST', createOneIntegration);
    addCorsOptions(items);

    const singleItem = items.addResource('{id}');
    const getOneIntegration = new apigateway.LambdaIntegration(getOneLambda);
    singleItem.addMethod('GET', getOneIntegration);

    const updateOneIntegration = new apigateway.LambdaIntegration(updateOne);
    singleItem.addMethod('PATCH', updateOneIntegration);

    const deleteOneIntegration = new apigateway.LambdaIntegration(deleteOne);
    singleItem.addMethod('DELETE', deleteOneIntegration);
    addCorsOptions(singleItem);*/
  }
}

function addCorsOptions(apiResource: apigateway.IResource) {
  apiResource.addMethod('OPTIONS', new apigateway.MockIntegration({
    integrationResponses: [{
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
        'method.response.header.Access-Control-Allow-Origin': "'*'",
        'method.response.header.Access-Control-Allow-Credentials': "'false'",
        'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE'",
      },
    }],
    passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
    requestTemplates: {
      "application/json": "{\"statusCode\": 200}"
    },
  }), {
    methodResponses: [{
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': true,
        'method.response.header.Access-Control-Allow-Methods': true,
        'method.response.header.Access-Control-Allow-Credentials': true,
        'method.response.header.Access-Control-Allow-Origin': true,
      },  
    }]
  })
}