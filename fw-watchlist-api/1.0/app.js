var mysql = require('mysql');
var AWS = require('aws-sdk');

var pool = mysql.createPool({
    connectionLimit: 20,
    host: process.env.RDS_ENDPOINT,
    user: process.env.RDS_USERNAME,
    password: process.env.RDS_PASSWORD,
    database: process.env.RDS_DATABASE,
    debug: false
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
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET,DELETE"
    };

    try {

        body = await new Promise((resolve, reject) => {
            switch (event.httpMethod) {

                case 'GET':
                    getStock().then(function (data) {
                        resolve(data);
                    }, reject);

                    break;

                case 'POST':
                    if (params.category == 'Watchlist' || params.category == 'portfolio') {
                        getWatchListLimit(params.category).then(function (data) {
                            if (data[0].count > 100) {
                                resolve({ statusCode: '400', message: "Watchlist limit of 100 exceeded." });
                            } else {
                                insertStock(params.value, params.category).then(resolve, reject);
                            }
                        });
                        
                    } else {
                        return insertStock(params.value, params.category).then(resolve, reject);
                    }

                    break;

                case 'DELETE':
                    return deleteStock(params.value).then(resolve, reject);

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

            connection.query(sql, function (err, result) {
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

function insertStock(value, category) {
    var post = {
        username: userid,
        value: value,
        category: category,
    };

    sql = "REPLACE INTO Watchlist SET ?";
    return executePostQuery(sql, post);
}

function getStock() {
    sql = "SELECT * FROM Watchlist WHERE username = '" + userid + "'";
    return executeQuery(sql);
}

function deleteStock(value) {
    sql = "DELETE FROM Watchlist \
            WHERE username = '" + userid + "' \
            AND value = '" + value + "' ";
    return executeQuery(sql);
}

function getWatchListLimit(category) {
    sql = "SELECT count(*) as count from Watchlist \
            WHERE username = '" + userid + "' \
            AND category = '" + category + "' ";

    return executeQuery(sql);
}