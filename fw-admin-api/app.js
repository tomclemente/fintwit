var mysql = require('mysql');
var AWS = require('aws-sdk');

var pool = mysql.createPool({
    connectionLimit : 20,
    host     : process.env.RDS_ENDPOINT,
    user     : process.env.RDS_USERNAME,
    password : process.env.RDS_PASSWORD,
    database : process.env.RDS_DATABASE,
    debug    :  false
});    

var sql;
var userid;

exports.handler = async (event, context) => {

    let params = JSON.parse(event["body"]);
    console.log('Received event:', JSON.stringify(event, null, 2));
    
    if (isEmpty(event.requestContext.authorizer.claims.username)) {
      userid = event.requestContext.authorizer.claims["cognito:username"];
    } else {
      userid = event.requestContext.authorizer.claims.username;
    }
    
    if (userid == null) {
        throw new Error("Username missing. Not authenticated.");
    }
    
    let body;
    let statusCode = '200';

    const headers = {
        'Content-Type': 'application/json',
        "Access-Control-Allow-Headers" : "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET,DELETE"
    };

    try {

        body = await new Promise((resolve, reject) => {
            switch (event.httpMethod) {

                case 'PUT':
                    getUser().then(function(data) {
                        if (!isEmpty(data)) {
                            if (data[0].userType != 'ADMIN') {
                                throw new Error ("Not Authorized");
                            } else {
                                return updateInsight(params).then(resolve, reject);
                            }
                        } else {                            
                            throw new Error("User not found.");
                        }
                    }, reject).catch(err => {
                        reject({ statusCode: 500, body: err.message });
                    });

                break;

                case 'POST':
                    getUser().then(function(data) {
                        if (!isEmpty(data)) {
                            if (data[0].userType != 'ADMIN') {
                                throw new Error ("Not Authorized");
                            } else {
                                if (isEmpty(params)) {
                                    return getInsight().then(resolve, reject);
                                } else {
                                    return getInsightParams(params).then(resolve, reject);
                                }
                                
                            }
                        } else {                            
                            throw new Error("User not found.");
                        }
                    }, reject).catch(err => {
                        reject({ statusCode: 500, body: err.message });
                    });


                case 'DELETE':
                    getUser().then(function(data) {
                        if (!isEmpty(data)) {
                            if (data[0].userType != 'ADMIN') {
                                throw new Error ("Not Authorized");
                            } else {
                                if (isEmpty(params)) {
                                    throw new Error ("ID Missing");
                                } else {
                                    return deleteInsight(params).then(resolve, reject);
                                }                                
                            }
                        } else {                            
                            throw new Error("User not found.");
                        }
                    }, reject).catch(err => {
                        reject({ statusCode: 500, body: err.message });
                    });

                default:
                    throw new Error(`Unsupported method "${event.httpMethod}"`);
            }
        });

    } catch (err) {
        statusCode = '400';
        body = err;
        console.log("body return 1", err);
        
    } finally {
        body = JSON.stringify(body);
    }

    return {
        statusCode,
        body,
        headers,
    };
};

function isEmpty(data) {
    if (data == undefined || data == null || data.length == 0) {
        return true;
    }
    return false;
}

function executeQuery(sql) {
    return new Promise((resolve, reject) => {

        pool.getConnection((err, connection) => {
            if (err) {
                console.log("executeQuery error: ", err);
                reject(err);
                return;
            }

            connection.query(sql, function(err, result) {
                connection.release();
                if (!err) {
                    console.log("Executed query: ", sql);
                    console.log("SQL Result: ", result[0] == undefined ? result : result[0]);
                    resolve(result);
                } else {
                    reject(err);
                }               
            });
        });
    });
};

function executePostQuery(sql, post) {
    return new Promise((resolve, reject) => {                
        pool.getConnection((err, connection) => {
            if (err) {
                console.log("executePostQuery error: ", err);
                reject(err);
                return;
            }

            connection.query(sql, post, function (err, result) {
                connection.release();
                if (!err) {
                    console.log("Executed post query: ", sql + " " + JSON.stringify(post));
                    console.log("SQL Result: ", result);
                    resolve(result);
                } else {
                    reject(err);
                }
            });
        }); 
    });
};

function getUser() {
    sql = "SELECT * FROM User WHERE username = '" + userid + "'";
    return executeQuery(sql);
}

function  updateInsight(params) {
    sql = "UPDATE Insight \
            SET class = '" + params.class + "', \
            processed = '" + params.processed + "' \
            WHERE ID = '" + params.id + "'";

    return executeQuery(sql);
}

function getInsight() {
    sql = "SELECT * FROM Insight  \
            WHERE class = 'PORTFOLIO' \
            AND processed is null";

    return executeQuery(sql);
}

function getInsightParams(params) {
    sql = "SELECT * FROM Insight \
            WHERE date = '" + params.date + "' \
            AND tUserName = '" + params.tUserName + "' \
            AND class = '" + params.class + "' \
            AND processed = '" + params.processed + "' ";

    return executeQuery(sql);
}

function deleteInsight(params) {
    sql = "DELETE FROM Insight \
            WHERE id = '" + params.id + "' ";
            
    return executeQuery(sql);
}
