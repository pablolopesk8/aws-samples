wscat -c wss://nkya07ha00.execute-api.us-east-2.amazonaws.com/test

// links
WebSocket URL: wss://nkya07ha00.execute-api.us-east-2.amazonaws.com/test
Connection URL: https://nkya07ha00.execute-api.us-east-2.amazonaws.com/test/@connections 

// dynamodb
/**
 * connectionSource
 * @param connectionId String
 * @param source String
 * @param sourceId String
 * @param userId String references to userSource table
 * @param ttl Number
 */
/**
 * userSource
 * @param id String uniqueId for table
 * @param userId String
 * @param source String
 * @param sourceId String references to userSource table
 * @param ttl Number
 */

 // possible sources
 // driverList, driverDetail, driverProfile


// driverList
// request: { "action": "driverList" }
// response: { "userid-123": ["lkjasd@kovi.com", "123@kovi.com"], "987": ["teste@kovi.com"] }
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

    const ttl = Math.floor(new Date().getTime()/1000.0)+(5*60);

    await addConnectionToSource(connectionId, 'driverList', '1', ttl);

    const usersToList = await getUsersToListview();
    console.log(usersToList);

    const usersByDriverId = {};
    usersToList.forEach((item) => {
      Array.isArray(usersByDriverId[item.sourceId]) ? usersByDriverId[item.sourceId].push(item.userId)
        : usersByDriverId[item.sourceId] = [ item.userId ];
    });

    await send(connectionId, JSON.stringify(usersByDriverId));
    
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

function addConnectionToSource(connectionId, source, sourceId, ttl) {
  return ddb.put({
    TableName: 'connectionSource',
    Item: { connectionId, source, sourceId, ttl },
  }).promise();
}

async function getUsersToListview() {
  const paramsDetail = {
    TableName : "userSource",
    IndexName: "source-sourceId-index",
    KeyConditionExpression: "#src = :s",
    ExpressionAttributeNames:{
      "#src": "source"
    },
    ExpressionAttributeValues: {
      ":s": "driverDetail"
    },
    ProjectionExpression: "userId, sourceId"
  };

  const paramsProfile = {
    TableName : "userSource",
    IndexName: "source-sourceId-index",
    KeyConditionExpression: "#src = :s",
    ExpressionAttributeNames:{
      "#src": "source"
    },
    ExpressionAttributeValues: {
      ":s": "driverProfile"
    },
    ProjectionExpression: "userId, sourceId"
  };

  const driverDetail = await ddb.query(paramsDetail).promise();
  const driverProfile = await ddb.query(paramsProfile).promise();
  
  return driverDetail.Items.concat(driverProfile.Items);
}


// driverDetail
// request: { "action": "driverDetail", "id": "123123", "email": "pablo.lopes.outro" }
// response for all driverDetail: ['email@email.com', 'email2@email.com']
// response for all driverList: { "userid-123": ["lkjasd@kovi.com", "123@kovi.com"], "987": ["teste@kovi.com"] }
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
    const { id: driverId, email } = body;
    const ttl = Math.floor(new Date().getTime()/1000.0)+(5*60);

    await addConnectionToSourceWithId(connectionId, 'driverDetail', driverId, ttl, email);

    await addUserToSource(email, 'driverDetail', driverId, ttl);

    const connectionsDriverDetail = await getAllConnectionsBySourceAndId('driverDetail', driverId);
    console.log(connectionsDriverDetail);

    const connectionsDriverList = await getAllConnectionsBySource('driverList');
    console.log(connectionsDriverList);

    const usersDriverDetail = await getAllUsersBySourceAndId('driverDetail', driverId);
    console.log(usersDriverDetail);

    const userDriverList = await getUsersToListview();
    console.log(userDriverList);

    const arrayUsersDriverDetail = [];
    usersDriverDetail.Items.forEach((item) => {
      arrayUsersDriverDetail.push(item.userId);
    });

    const usersByDriverId = {};
    userDriverList.forEach((item) => {
      Array.isArray(usersByDriverId[item.sourceId]) ? usersByDriverId[item.sourceId].push(item.userId)
        : usersByDriverId[item.sourceId] = [ item.userId ];
    });

    const messagesSend = [];
    connectionsDriverDetail.Items.forEach((item) => {
      messagesSend.push(send(item.connectionId, JSON.stringify(arrayUsersDriverDetail)));
    });
    connectionsDriverList.Items.forEach((item) => {
      messagesSend.push(send(item.connectionId, JSON.stringify(usersByDriverId)));
    });

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

function addConnectionToSourceWithId(connectionId, source, sourceId, ttl, userId) {
  return ddb.put({
    TableName: 'connectionSource',
    Item: { connectionId, source, sourceId, ttl, userId },
  }).promise();
}

function addUserToSource(userId, source, sourceId, ttl) {
  const uniqueId = String(Date.now());

  return ddb.put({
    TableName: 'userSource',
    Item: { id: uniqueId, userId, source, sourceId, ttl },
  }).promise();
}

function getAllConnectionsBySourceAndId(source, sourceId) {
  const  params = {
    TableName : "connectionSource",
    IndexName: "source-sourceId-index",
    KeyConditionExpression: "#src = :s and sourceId = :i",
    ExpressionAttributeNames:{
      "#src": "source"
    },
    ExpressionAttributeValues: {
      ":s": source,
      ":i": sourceId
    },
    ProjectionExpression: "connectionId"
  };
  
  return ddb.query(params).promise();
}

function getAllConnectionsBySource(source) {
  const  params = {
    TableName : "connectionSource",
    IndexName: "source-sourceId-index",
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

function getAllUsersBySourceAndId(source, sourceId) {
  const  params = {
    TableName : "userSource",
    IndexName: "source-sourceId-index",
    KeyConditionExpression: "#src = :s and sourceId = :i",
    ExpressionAttributeNames:{
      "#src": "source"
    },
    ExpressionAttributeValues: {
      ":s": source,
      ":i": sourceId
    },
    ProjectionExpression: "userId"
  };
  
  return ddb.query(params).promise();
}

async function getUsersToListview() {
  const paramsDetail = {
    TableName : "userSource",
    IndexName: "source-sourceId-index",
    KeyConditionExpression: "#src = :s",
    ExpressionAttributeNames:{
      "#src": "source"
    },
    ExpressionAttributeValues: {
      ":s": "driverDetail"
    },
    ProjectionExpression: "userId, sourceId"
  };

  const paramsProfile = {
    TableName : "userSource",
    IndexName: "source-sourceId-index",
    KeyConditionExpression: "#src = :s",
    ExpressionAttributeNames:{
      "#src": "source"
    },
    ExpressionAttributeValues: {
      ":s": "driverProfile"
    },
    ProjectionExpression: "userId, sourceId"
  };

  const driverDetail = await ddb.query(paramsDetail).promise();
  const driverProfile = await ddb.query(paramsProfile).promise();
  
  return driverDetail.Items.concat(driverProfile.Items);
}


// driverProfile
// request: { "action": "driverProfile", "id": "123123", "email": "pablo.lopes" }
// response for all driverProfile: ['email@email.com', 'email2@email.com']
// response for all driverList: { "userid-123": ["lkjasd@kovi.com", "123@kovi.com"], "987": ["teste@kovi.com"] }
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
    const { id: driverId, email } = body;
    const ttl = Math.floor(new Date().getTime()/1000.0)+(5*60);

    await addConnectionToSourceWithId(connectionId, 'driverProfile', driverId, ttl, email);

    await addUserToSource(email, 'driverProfile', driverId, ttl);

    const connectionsDriverProfile = await getAllConnectionsBySourceAndId('driverProfile', driverId);
    console.log(connectionsDriverProfile);

    const connectionsDriverList = await getAllConnectionsBySource('driverList');
    console.log(connectionsDriverList);

    const usersDriverProfile = await getAllUsersBySourceAndId('driverProfile', driverId);
    console.log(usersDriverProfile);

    const userDriverList = await getUsersToListview();
    console.log(userDriverList);

    const arrayUsersDriverProfile = [];
    usersDriverProfile.Items.forEach((item) => {
      arrayUsersDriverProfile.push(item.userId);
    });

    const usersByDriverId = {};
    userDriverList.forEach((item) => {
      Array.isArray(usersByDriverId[item.sourceId]) ? usersByDriverId[item.sourceId].push(item.userId)
        : usersByDriverId[item.sourceId] = [ item.userId ];
    });

    const messagesSend = [];
    connectionsDriverProfile.Items.forEach((item) => {
      messagesSend.push(send(item.connectionId, JSON.stringify(arrayUsersDriverProfile)));
    });
    connectionsDriverList.Items.forEach((item) => {
      messagesSend.push(send(item.connectionId, JSON.stringify(usersByDriverId)));
    });

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

function addConnectionToSourceWithId(connectionId, source, sourceId, ttl, userId) {
  return ddb.put({
    TableName: 'connectionSource',
    Item: { connectionId, source, sourceId, ttl, userId },
  }).promise();
}

function addUserToSource(userId, source, sourceId, ttl) {
  const uniqueId = String(Date.now());

  return ddb.put({
    TableName: 'userSource',
    Item: { id: uniqueId, userId, source, sourceId, ttl },
  }).promise();
}

function getAllConnectionsBySourceAndId(source, sourceId) {
  const  params = {
    TableName : "connectionSource",
    IndexName: "source-sourceId-index",
    KeyConditionExpression: "#src = :s and sourceId = :i",
    ExpressionAttributeNames:{
      "#src": "source"
    },
    ExpressionAttributeValues: {
      ":s": source,
      ":i": sourceId
    },
    ProjectionExpression: "connectionId"
  };
  
  return ddb.query(params).promise();
}

function getAllConnectionsBySource(source) {
  const  params = {
    TableName : "connectionSource",
    IndexName: "source-sourceId-index",
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

function getAllUsersBySourceAndId(source, sourceId) {
  const  params = {
    TableName : "userSource",
    IndexName: "source-sourceId-index",
    KeyConditionExpression: "#src = :s and sourceId = :i",
    ExpressionAttributeNames:{
      "#src": "source"
    },
    ExpressionAttributeValues: {
      ":s": source,
      ":i": sourceId
    },
    ProjectionExpression: "userId"
  };
  
  return ddb.query(params).promise();
}

async function getUsersToListview() {
  const paramsDetail = {
    TableName : "userSource",
    IndexName: "source-sourceId-index",
    KeyConditionExpression: "#src = :s",
    ExpressionAttributeNames:{
      "#src": "source"
    },
    ExpressionAttributeValues: {
      ":s": "driverDetail"
    },
    ProjectionExpression: "userId, sourceId"
  };

  const paramsProfile = {
    TableName : "userSource",
    IndexName: "source-sourceId-index",
    KeyConditionExpression: "#src = :s",
    ExpressionAttributeNames:{
      "#src": "source"
    },
    ExpressionAttributeValues: {
      ":s": "driverProfile"
    },
    ProjectionExpression: "userId, sourceId"
  };

  const driverDetail = await ddb.query(paramsDetail).promise();
  const driverProfile = await ddb.query(paramsProfile).promise();
  
  return driverDetail.Items.concat(driverProfile.Items);
}


// driverDisconnect
// request: { "action": "driverDisconnect" }
// response for all driverDetail: ['email@email.com', 'email2@email.com']
// response for all driverProfile: ['email@email.com', 'email2@email.com']
// response for all driverList: { "userid-123": ["lkjasd@kovi.com", "123@kovi.com"], "987": ["teste@kovi.com"] }
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

      if (connection.Item.source === 'driverDetail' || connection.Item.source === 'driverProfile') {
        const promiseDelUser = [];

        const usersConnection = await getUserByIdSourceAndSourceId(connection.Item.userId, connection.Item.source, connection.Item.sourceId);
        console.log('users connection', usersConnection);

        if (usersConnection.Items.length > 0) {
          usersConnection.Items.forEach((item) => {
            promiseDelUser.push(delUser(item.id));
          });
        }

        const messagesSend = [];

        const connectionsOnDriver = await getAllConnectionsOnDriver(connection.Item.sourceId);
        console.log('connections on driver', connectionsOnDriver);

        const connectionsDriverList = await getAllConnectionsBySource('driverList');
        console.log('connections driver list', connectionsDriverList);

        if (connectionsOnDriver.length > 0) {
          const usersOnDriver = await getAllUsersOnDriver(connection.Item.sourceId);
          console.log('users on driver', usersOnDriver);

          const usersOnDriverArray = [];
          usersOnDriver.forEach((item) => {
            usersOnDriverArray.push(item.userId);
          });
  
          connectionsOnDriver.forEach((item) => {
            // TODO fix this. To send a message to the connection deleted before generetas error
            if (item.connectionId !== connectionId) {
              messagesSend.push(send(item.connectionId, JSON.stringify(usersOnDriverArray)));
            }
          });
        }

        if (connectionsDriverList.Items) {
          const usersDriverList = await getUsersToListview();
          console.log('users driver list', usersDriverList);

          const usersByDriverId = {};
          usersDriverList.forEach((item) => {
            Array.isArray(usersByDriverId[item.sourceId]) ? usersByDriverId[item.sourceId].push(item.userId)
              : usersByDriverId[item.sourceId] = [ item.userId ];
          });

          connectionsDriverList.Items.forEach((item) => {
            messagesSend.push(send(item.connectionId, JSON.stringify(usersByDriverId)));
          });
        }

        await Promise.all(promiseDelUser.concat(messagesSend));
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

function getUserByIdSourceAndSourceId(userId, source, sourceId) {
  const  params = {
    TableName : "userSource",
    IndexName: "source-sourceId-index",
    KeyConditionExpression: "#src = :s and sourceId = :i",
    FilterExpression: "userId = :u",
    ExpressionAttributeNames:{
      "#src": "source"
    },
    ExpressionAttributeValues: {
      ":s": source,
      ":i": sourceId,
      ":u": userId
    },
    ProjectionExpression: "id"
  };
  
  return ddb.query(params).promise();
}

async function delUser(id) {
  try {
    const params = {
      TableName: 'userSource',
      Key: { id: id },
    };

    await ddb.delete(params).promise();

    return true;
  } catch (err) {
    console.log(`del user error-${err}`);
    return false;
  }
}

async function getAllConnectionsOnDriver(sourceId) {
  const paramsDetail = {
    TableName : "connectionSource",
    IndexName: "source-sourceId-index",
    KeyConditionExpression: "#src = :s and sourceId = :i",
    ExpressionAttributeNames:{
      "#src": "source"
    },
    ExpressionAttributeValues: {
      ":s": "driverDetail",
      ":i": sourceId
    },
    ProjectionExpression: "connectionId, sourceId"
  };

  const paramsProfile = {
    TableName : "connectionSource",
    IndexName: "source-sourceId-index",
    KeyConditionExpression: "#src = :s and sourceId = :i",
    ExpressionAttributeNames:{
      "#src": "source"
    },
    ExpressionAttributeValues: {
      ":s": "driverProfile",
      ":i": sourceId
    },
    ProjectionExpression: "connectionId, sourceId"
  };

  const connectionsDetail = await ddb.query(paramsDetail).promise();
  const connectionsProfile = await ddb.query(paramsProfile).promise();
  
  return connectionsDetail.Items.concat(connectionsProfile.Items);
}

function getAllConnectionsBySource(source) {
  const  params = {
    TableName : "connectionSource",
    IndexName: "source-sourceId-index",
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

async function getAllUsersOnDriver(sourceId) {
  const paramsDetail = {
    TableName : "userSource",
    IndexName: "source-sourceId-index",
    KeyConditionExpression: "#src = :s and sourceId = :i",
    ExpressionAttributeNames:{
      "#src": "source"
    },
    ExpressionAttributeValues: {
      ":s": "driverDetail",
      ":i": sourceId
    },
    ProjectionExpression: "userId, sourceId"
  };

  const paramsProfile = {
    TableName : "userSource",
    IndexName: "source-sourceId-index",
    KeyConditionExpression: "#src = :s and sourceId = :i",
    ExpressionAttributeNames:{
      "#src": "source"
    },
    ExpressionAttributeValues: {
      ":s": "driverProfile",
      ":i": sourceId
    },
    ProjectionExpression: "userId, sourceId"
  };

  const driverDetail = await ddb.query(paramsDetail).promise();
  const driverProfile = await ddb.query(paramsProfile).promise();
  
  return driverDetail.Items.concat(driverProfile.Items);
}

async function getUsersToListview() {
  const paramsDetail = {
    TableName : "userSource",
    IndexName: "source-sourceId-index",
    KeyConditionExpression: "#src = :s",
    ExpressionAttributeNames:{
      "#src": "source"
    },
    ExpressionAttributeValues: {
      ":s": "driverDetail"
    },
    ProjectionExpression: "userId, sourceId"
  };

  const paramsProfile = {
    TableName : "userSource",
    IndexName: "source-sourceId-index",
    KeyConditionExpression: "#src = :s",
    ExpressionAttributeNames:{
      "#src": "source"
    },
    ExpressionAttributeValues: {
      ":s": "driverProfile"
    },
    ProjectionExpression: "userId, sourceId"
  };

  const driverDetail = await ddb.query(paramsDetail).promise();
  const driverProfile = await ddb.query(paramsProfile).promise();
  
  return driverDetail.Items.concat(driverProfile.Items);
}



// disconnect
const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event, context, callback) => {
  try {
    const connectionId = event.requestContext.connectionId;

    const connection = await getConnection(connectionId);
    console.log(connection);

    if (connection.Item) {
      await delConnection(connection.Item.connectionId);

      const promiseDelUser = [];

      const usersConnection = await getUserByIdSourceAndSourceId(connection.Item.userId, connection.Item.source, connection.Item.sourceId);
      console.log('users connection', usersConnection);

      if (usersConnection.Items.length > 0) {
        usersConnection.Items.forEach((item) => {
          promiseDelUser.push(delUser(item.id));
        });
      }

      await Promise.all(promiseDelUser);

      callback(null, {
        statusCode: 200,
      });
    }
  } catch (err) {
    console.log(err);
    callback(null, {
      statusCode: 500,
    });
  }
};

function getConnection(connectionId) {
  const  params = {
    TableName : 'connectionSource',
    Key: { connectionId: connectionId }
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

function getUserByIdSourceAndSourceId(userId, source, sourceId) {
  const  params = {
    TableName : "userSource",
    IndexName: "source-sourceId-index",
    KeyConditionExpression: "#src = :s and sourceId = :i",
    FilterExpression: "userId = :u",
    ExpressionAttributeNames:{
      "#src": "source"
    },
    ExpressionAttributeValues: {
      ":s": source,
      ":i": sourceId,
      ":u": userId
    },
    ProjectionExpression: "id"
  };
  
  return ddb.query(params).promise();
}

async function delUser(id) {
  try {
    const params = {
      TableName: 'userSource',
      Key: { id: id },
    };

    await ddb.delete(params).promise();

    return true;
  } catch (err) {
    console.log(`del user error-${err}`);
    return false;
  }
}



// connectionSource delete trigger
// response for all driverDetail: ['email@email.com', 'email2@email.com']
const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();

const domainName = 'nkya07ha00.execute-api.us-east-2.amazonaws.com';
const stage = 'test';
let send;

exports.handler = async (event, context) => {
  try {
    init();

    const record = event.Records[0];
    const eventName = record.eventName;
    console.log('event', eventName);

    if (eventName === 'REMOVE') {
      const item = record.dynamodb.OldImage;

      console.log(`item: ${item.connectionId.S} - ${item.sourceId.S} - ${item.source.S}`);

      if (!item.source || !item.sourceId || (item.source.S !== 'driverDetail' && item.source.S !== 'driverProfile')) return {};

      const connections = await getAllConnectionsBySourceAndId(item.source.S, item.sourceId.S);
      console.log('connections', connections);

      if (!connections.Items || connections.Items.length <= 0) return {};

      const users = await getAllUsersBySourceAndId(item.source.S, item.sourceId.S);
      const arrayUsers = [];
      users.Items.forEach((item) => {
        arrayUsers.push(item.userId);
      });
      console.log('array users', arrayUsers);

      const messagesSend = [];
      connections.Items.forEach((item) => {
        messagesSend.push(send(item.connectionId, JSON.stringify(arrayUsers)));
      });

      await Promise.all(messagesSend);

      return {};
    }
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

function getAllConnectionsBySourceAndId(source, sourceId) {
  const  params = {
    TableName : "connectionSource",
    IndexName: "source-sourceId-index",
    KeyConditionExpression: "#src = :s and sourceId = :i",
    ExpressionAttributeNames:{
      "#src": "source"
    },
    ExpressionAttributeValues: {
      ":s": source,
      ":i": sourceId
    },
    ProjectionExpression: "connectionId"
  };
  
  return ddb.query(params).promise();
}

function getAllUsersBySourceAndId(source, sourceId) {
  const  params = {
    TableName : "userSource",
    IndexName: "source-sourceId-index",
    KeyConditionExpression: "#src = :s and sourceId = :i",
    ExpressionAttributeNames:{
      "#src": "source"
    },
    ExpressionAttributeValues: {
      ":s": source,
      ":i": sourceId
    },
    ProjectionExpression: "userId"
  };
  
  return ddb.query(params).promise();
}

this.websocket = new WebSocket('wss://xxxxxx.execute-api.us-east-2.amazonaws.com/dev');
this.websocket.onopen = function (evt) { onOpen(evt) };
this.websocket.onclose = function(evt) { onClose(evt) };
this.websocket.onmessage = function(evt) { onMessage(evt) };
this.websocket.onerror = function(evt) { onError(evt) };