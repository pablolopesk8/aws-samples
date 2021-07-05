// links
WebSocket URL: wss://nkya07ha00.execute-api.us-east-2.amazonaws.com/test
Connection URL: https://nkya07ha00.execute-api.us-east-2.amazonaws.com/test/@connections 

// exemplo message
{"action" : "OnMessage" , "message" : {"123abc": ["pablo", "denis"], "456xyz": ["junior", "joao"]}}
{"action": "OnMessage", "id": "12312323", "email": "pablo.lopes", "message": {"123abc": ["pablo", "denis"], "456xyz": ["junior", "joao"]}}


// connect
const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event, context, callback) => {
  const connectionId = event.requestContext.connectionId;
  await addConnectionId(connectionId);
  callback(null, {
    statusCode: 200,
  });
}

function addConnectionId(connectionId) {
  return ddb.put({
    TableName: 'connections',
    Item: {
      connectionId,
    },
  }).promise();
}


// disconnect
const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event, context, callback) => {
  const connectionId = event.requestContext.connectionId;
  await delConnectionId(connectionId);
  callback(null, {
    statusCode: 200,
  });
}

function delConnectionId(connectionId) {
  return ddb.delete({
    TableName: 'connections',
    Key: {
      connectionId,
    },
  }).promise();
}


// OnMessage
const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();
require('./patch.js');

let send = undefined;

function init(event) {
  console.log(event);
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
  });
  send = async (connectionId, data) => {
    return apigwManagementApi.postToConnection({ ConnectionId: connectionId, Data: data }).promise();
  }
}

exports.handler = async (event, context, callback) => {
  console.log('index ', context);
  init(event);
  let message = JSON.parse(event.body).message;
  const connections = await getConnections();
  console.log(connections.Items);
  const promisesSend = [];
  connections.Items.forEach(function(connection) {
    console.log("Connection " +connection.connectionId);
    promisesSend.push(send(connection.connectionId, JSON.stringify(message)));
  });
  await Promise.all(promisesSend);
  return {};
};

function getConnections(){
  return ddb.scan({
    TableName: 'connections',
  }).promise();
}


// patch.js
require('aws-sdk/lib/node_loader');
var AWS = require('aws-sdk/lib/core');
var Service = AWS.Service;
var apiLoader = AWS.apiLoader;

apiLoader.services['apigatewaymanagementapi'] = {};
AWS.ApiGatewayManagementApi = Service.defineService('apigatewaymanagementapi', ['2018-11-29']);
Object.defineProperty(
  apiLoader.services['apigatewaymanagementapi'], 
  '2018-11-29',
  {
    get: function get() {
      var model = {
        "metadata": {
          "apiVersion": "2018-11-29",
          "endpointPrefix": "execute-api",
          "signingName": "execute-api",
          "serviceFullName": "AmazonApiGatewayManagementApi",
          "serviceId": "ApiGatewayManagementApi",
          "protocol": "rest-json",
          "jsonVersion": "1.1",
          "uid": "apigatewaymanagementapi-2018-11-29",
          "signatureVersion": "v4"
        },
        "operations": {
          "PostToConnection": { 
            "http": {
              "requestUri": "/@connections/{connectionId}",
              "responseCode": 200
            },
            "input": {
              "type": "structure",
              "members": {
                "Data": {
                  "type": "blob"
                },
                "ConnectionId": {
                  "location": "uri",
                  "locationName": "connectionId",
                }
              },
              "required": [ "ConnectionId", "Data" ],
              "payload": "Data"
            }
          }
        },
        "shapes": {}
      }
      model.paginators = {
        "pagination": {}
      }
      return model; 
    },  
    enumerable: true,
    configurable: true
  }
);

module.exports = AWS.ApiGatewayManagementApi;


https://serverless.com/blog/api-gateway-websockets-support/
https://aws.amazon.com/pt/blogs/aws/dynamodb-update-triggers-streams-lambda-cross-region-replication-app/
https://docs.aws.amazon.com/pt_br/amazondynamodb/latest/APIReference/API_AttributeValue.html
https://docs.aws.amazon.com/pt_br/amazondynamodb/latest/developerguide/GSI.html
https://docs.aws.amazon.com/pt_br/amazondynamodb/latest/developerguide/GettingStarted.NodeJs.03.html#GettingStarted.NodeJs.03.06
https://docs.aws.amazon.com/pt_br/amazondynamodb/latest/developerguide/time-to-live-ttl-how-to.html
https://docs.aws.amazon.com/pt_br/apigateway/latest/developerguide/apigateway-how-to-call-websocket-api-connections.html
https://www.toptal.com/software/definitive-guide-to-datetime-manipulation
https://www.epochconverter.com/
https://www.freecodecamp.org/news/real-time-applications-using-websockets-with-aws-api-gateway-and-lambda-a5bb493e9452/
https://aws.amazon.com/pt/blogs/compute/announcing-websocket-apis-in-amazon-api-gateway/
