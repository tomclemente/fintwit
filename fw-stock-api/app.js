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
        "Access-Control-Allow-Methods": "OPTIONS,POST"
    };

    try {

        body = await new Promise((resolve, reject) => {

                switch (event.httpMethod) {
                    case 'POST':      
                        getUser().then(function(data) {
                            if (!isEmpty(data)) {
                                if  (data[0].subscriptionStatus == 'ACTIVE') {
                                    if (params.watchlist == 'Y') {
                                        return getWatchList(data[0].username);
                                    } else if (!isEmpty(params.ticker)) {
                                        return getTicker(params);
                                    }

                                } else if (isEmpty(params)) {
                                    return getStockList();
                                }
                            } else {
                                throw new Error("User not found found. Unable to perform operation");
                            }       

                        }).catch(err => {
                            reject({ statusCode: 500, body: err.message });
                        }); 
                    break;
                        
                    default:
                        throw new Error(`Unsupported method "${event.httpMethod}"`);
                }
            });

    } catch (err) {
        statusCode = '400';
        body = err;
        console.log("error return: ", err);
        
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

function getUser() {
    sql = "SELECT * FROM User WHERE email = '" + userid + "'";
    return executeQuery(sql);
}

function getWatchList(username) {
    sql = "SELECT * FROM Stock INNER JOIN Watchlist \
            ON Stock.ticker = Watchlist.ticker \
            AND Watchlist.username = '" + username + "'";
    return executeQuery(sql);
}

function getStockList() {
    sql = "SELECT * FROM Stock";
    return executeQuery(sql);
}

function getTicker(params) {
    sql = "SELECT * FROM StockChart \
            WHERE ticker = '" + params.ticker + "'";
    return executeQuery(sql);
}