wscat -c wss://nkya07ha00.execute-api.us-east-2.amazonaws.com/test

// links
WebSocket URL: wss://nkya07ha00.execute-api.us-east-2.amazonaws.com/test
Connection URL: https://nkya07ha00.execute-api.us-east-2.amazonaws.com/test/@connections 

// exemplo message
{"action" : "OnMessage" , "message" : {"123abc": ["pablo", "denis"], "456xyz": ["junior", "joao"]}}
{"action": "OnMessage", "id": "12312323", "email": "pablo.lopes", "message": {"123abc": ["pablo", "denis"], "456xyz": ["junior", "joao"]}}


// driverList
// request: { "action": "driverList" }
// response: { "userid-123": ["lkjasd@kovi.com", "123@kovi.com"], "987": ["teste@kovi.com"] }
const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();

const domainName = 'nkya07ha00.execute-api.us-east-2.amazonaws.com';
const stage = 'test';
let send;

exports.handler = async (event, context, callback) => {
  init();

  const connectionId = event.requestContext.connectionId;
  console.log(connectionId);

  const ttl = Math.floor(new Date().getTime()/1000.0)+(5*60);

  await addConnectionToSource(connectionId, 'DriverList', ttl);

  const usersEditDrivers = await getAllUsersBySource('DriverEdit');
  console.log(usersEditDrivers);

  const usersByDriverId = {};
  usersEditDrivers.Items.forEach((item) => {
    Array.isArray(usersByDriverId[item.id]) ? usersByDriverId[item.id].push(item.userId)
      : usersByDriverId[item.id] = [ item.userId ];
  });

  await send(connectionId, JSON.stringify(usersByDriverId));
  
  callback(null, {
    statusCode: 200,
  });
};

function init() {
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    endpoint: `${domainName}/${stage}`
  });
  send = async (connectionId, data) => {
    return apigwManagementApi.postToConnection({ ConnectionId: connectionId, Data: data }).promise();
  }
}

function addConnectionToSource(connectionId, source, ttl) {
  return ddb.put({
    TableName: 'connectionSource',
    Item: { connectionId, source, ttl },
  }).promise();
}

function getAllUsersBySource(source) {
  const  params = {
    TableName : "userSource",
    IndexName: "source-id-index",
    KeyConditionExpression: "#src = :s",
    ExpressionAttributeNames:{
      "#src": "source"
    },
    ExpressionAttributeValues: {
      ":s": source
    },
    ProjectionExpression: "userId, id"
  };
  
  return ddb.query(params).promise();
}

// driverEdit
// request: { "action": "driverEdit", "driverId": "123123", "email": "pablo.lopes" }
// response: ['email@email.com', 'email2@email.com']
const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();

const domainName = 'nkya07ha00.execute-api.us-east-2.amazonaws.com';
const stage = 'test';
let send;

exports.handler = async (event, context, callback) => {
  try {
    init();

    const connectionId = event.requestContext.connectionId;
    console.log(connectionId);
    const body = JSON.parse(event.body);
    const { driverId, email } = body;

    const source = 'DriverEdit';
    const ttl = Math.floor(new Date().getTime()/1000.0)+(5*60);

    await addConnectionToSourceWithId(connectionId, source, driverId, ttl);

    await addUserToSource(email, source, driverId, ttl);

    const users = await getAllUsersBySourceAndId(source, driverId);
    console.log(users);
    const userEdit = [];
    users.Items.forEach((item) => {
      userEdit.push(item.userId);
    });

    await send(connectionId, JSON.stringify(userEdit));

    callback(null, {
      statusCode: 200,
    });
  } catch (err) {
    console.log(err);
    callback(null, {
      statusCode: 500,
    });
  }
};

function init() {
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    endpoint: `${domainName}/${stage}`
  });
  send = async (connectionId, data) => {
    return apigwManagementApi.postToConnection({ ConnectionId: connectionId, Data: data }).promise();
  }
}

function addConnectionToSourceWithId(connectionId, source, id, ttl) {
  return ddb.put({
    TableName: 'connectionSource',
    Item: { connectionId, source, id, ttl },
  }).promise();
}

function addUserToSource(userId, source, id, ttl) {
  return ddb.put({
    TableName: 'userSource',
    Item: { userId, source, id, ttl },
  }).promise();
}

function getAllUsersBySourceAndId(source, id) {
  const  params = {
    TableName : "userSource",
    IndexName: "source-id-index",
    KeyConditionExpression: "#src = :s and id = :i",
    ExpressionAttributeNames:{
      "#src": "source"
    },
    ExpressionAttributeValues: {
      ":s": source,
      ":i": id
    },
    ProjectionExpression: "userId"
  };
  
  return ddb.query(params).promise();
}


// disconnect
const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();

const domainName = 'nkya07ha00.execute-api.us-east-2.amazonaws.com';
const stage = 'test';
let send;

exports.handler = async (event, context, callback) => {
  init();

  try {
    const connectionId = event.requestContext.connectionId;

    const connection = await getConnection(connectionId);
    console.log(connection);

    if (connection.Item) {
      await delConnection(connection.Item.connectionId);
    }

    const user = await getUser(connection.Item.userId);
    console.log(user);

    if (user.Item) {
      await delUser(user.Item.userId);

      if (user.Item.source === 'DriverEdit') {
        const messagesSend = [];

        const connDriverEdit = await getAllConnectionsBySourceAndId('DriverEdit', user.id);
        const connDriverList = await getAllConnectionsBySource('DriverList');

        if (connDriverEdit.Items) {
          const usersDriverEdit = await getAllUsersBySourceAndId('DriverEdit', user.id);

          if (usersDriverEdit.Items) {
            const usersArray = [];
            usersDriverEdit.Items.forEach((item) => {
              usersArray.push(item.userId);
            });
    
            connDriverEdit.Items.forEach((item) => {
              messagesSend.push(send(item.connectionId, JSON.stringify(usersArray)));
            });
          }
        }

        if (connDriverList.Items) {
          const usersAllDriversEdit = await getAllUsersBySource('DriverEdit');

          if (usersAllDriversEdit.Items) {
            const userEditByDriver = {};
            usersAllDriversEdit.Items.forEach((item) => {
              Array.isArray(userEditByDriver[item.id]) ? userEditByDriver[item.id].push(item.userId)
                : userEditByDriver[item.id] = [ item.userId ];
            });

            connDriverList.Items.forEach((item) => {
              messagesSend.push(send(item.connectionId, JSON.stringify(userEditByDriver)));
            });
          }
        }

        await Promise.all(messagesSend);
      }
    }

    callback(null, {
      statusCode: 200,
    });
  } catch (err) {
    console.log(err);
    callback(null, {
      statusCode: 500,
    });
  }
};

function init() {
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    endpoint: `${domainName}/${stage}`
  });
  send = async (connectionId, data) => {
    return apigwManagementApi.postToConnection({ ConnectionId: connectionId, Data: data }).promise();
  };
}

function getConnection(connectionId) {
  const  params = {
    TableName : 'connectionSource',
    Key: { connectionId: connectionId }
  };
  
  return ddb.get(params).promise();
}

function getUser(userId) {
  const  params = {
    TableName : 'userSource',
    Key: { userId: userId }
  };
  
  return ddb.get(params).promise();
}

async function delConnection(connectionId) {
  try {
    const params = {
      TableName: 'connectionSource',
      Key: { connectionId: connectionId },
    };

    await ddb.delete(params).promise();

    return true;
  } catch (err) {
    console.log(`del conn error-${err}`);
    return false;
  }
}

async function delUser(userId) {
  try {
    const params = {
      TableName: 'userSource',
      Key: { userId: userId },
    };
  
    await ddb.delete(params).promise();

    return true;
  } catch (err) {
    console.log(`del conn error-${err}`);
    return false;
  }
}

function getAllConnectionsBySourceAndId(source, id) {
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

function getAllConnectionsBySource(source) {
  const  params = {
    TableName : "connectionSource",
    IndexName: "source-id-index",
    KeyConditionExpression: "#src = :s",
    ExpressionAttributeNames:{
      "#src": "source"
    },
    ExpressionAttributeValues: {
      ":s": source
    },
    ProjectionExpression: "connectionId"
  };
  
  return ddb.query(params).promise();
}

function getAllUsersBySourceAndId(source, id) {
  const  params = {
    TableName : "userSource",
    IndexName: "source-id-index",
    KeyConditionExpression: "#src = :s and id = :i",
    ExpressionAttributeNames:{
      "#src": "source"
    },
    ExpressionAttributeValues: {
      ":s": source,
      ":i": id
    },
    ProjectionExpression: "userId"
  };
  
  return ddb.query(params).promise();
}

function getAllUsersBySource(source, id) {
  const  params = {
    TableName : "userSource",
    IndexName: "source-id-index",
    KeyConditionExpression: "#src = :s",
    ExpressionAttributeNames:{
      "#src": "source"
    },
    ExpressionAttributeValues: {
      ":s": source
    },
    ProjectionExpression: "userId, id"
  };
  
  return ddb.query(params).promise();
}


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


// connect



var obj  = {"123123":["pablo.lopes", "", ""],"123123456":["pablo.lopes.outro"]}

obj["123123"]

["pablo.lopes", "", ""]