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
  console.log(connectionId);

  const source = 'DriverEdit';
  const driverId = '123456';

  const ttl = Math.floor(new Date().getTime()/1000.0)+(5*60);
  
  await addConnection(connectionId, source, driverId, ttl);

  const connections = await getConnectionsBySourceAndId(source, driverId);
  console.log(connections);
  
  callback(null, {
    statusCode: 200,
  });
}

function addConnection(connectionId, source, id, ttl) {
  return ddb.put({
    TableName: 'connectionSource',
    Item: { connectionId, source, id, ttl },
  }).promise();
}

function getConnectionsBySourceAndId(source, id) {
  const  params = {
    TableName : "connectionSource",
    IndexName: "source-id-index",
    KeyConditionExpression: "#src = :s and id = :i",
    ExpressionAttributeNames:{
      "#src": "source"
    },
    ExpressionAttributeValues: {
      ":s": source,
      ":i": id
    },
    ProjectionExpression: "connectionId"
  };
  
  return ddb.query(params).promise();
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
    TableName: 'connectionSource',
    Key: {
      connectionId, source: 'DriverEdit'
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


// trigger
const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();

const domainName = 'nkya07ha00.execute-api.us-east-2.amazonaws.com';
const stage = 'test';

let send = undefined;

exports.handler = async (event, context) => {
  // for (const record of event.Records) {
  //     console.log(record.eventID);
  //     console.log(record.eventName);
  //     console.log('DynamoDB Record: %j', record.dynamodb);
  // }
  // return `Successfully processed ${event.Records.length} records.`;

  try {
    init();

    const record = event.Records[0];
    const eventName = record.eventName;
    console.log(eventName);
    
    let item;
    if (eventName === 'INSERT' || eventName === 'MODIFY') {
      item = record.dynamodb.NewImage;
    } else if (eventName === 'REMOVE') {
      item = record.dynamodb.OldImage;
    }
    console.log(`item: ${item.connectionId.S} - ${item.id.S} - ${item.source.S}`);

    if (!item.source) return {};

    const connections = await getConnectionsBySourceAndId(item.source.S, item.id.S);

    const connectionsList = [];
    connections.Items.forEach(function(connection) {
      connectionsList.push(connection.connectionId);
    });
    console.log(connectionsList);

    const promisesSend = [];
    connections.Items.forEach(function(connection) {
      console.log("Connection " +connection.connectionId);
      promisesSend.push(send(connection.connectionId, JSON.stringify(connectionsList)));
    });
    await Promise.all(promisesSend);

    return {};
  } catch (err) {
    console.log(err);
    return {};
  }
};

function init() {
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    endpoint: `${domainName}/${stage}`
  });
  send = async (connectionId, data) => {
    console.log(data);
    return apigwManagementApi.postToConnection({ ConnectionId: connectionId, Data: data }).promise();
  }
}

function getConnectionsBySourceAndId(source, id){
  const  params = {
    TableName : "connectionSource",
    IndexName: "source-id-index",
    KeyConditionExpression: "#src = :s and id = :i",
    ExpressionAttributeNames:{
      "#src": "source"
    },
    ExpressionAttributeValues: {
      ":s": source,
      ":i": id
    },
    ProjectionExpression: "connectionId"
  };
  
  return ddb.query(params).promise();
}