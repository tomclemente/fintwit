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
var resp = new Object();
var price = new Array();
var timedata = new Object();

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
                        getUser().then(async function(data) {
                            if (!isEmpty(data)) {
                                if  (data[0].subscriptionStatus == 'ACTIVE') {

                                    if (!isEmpty(params) && params.watchlist == 'Y') {
                                        resp = await getWatchList(data[0].username);
                                    } else if (!isEmpty(params) && !isEmpty(params.ticker)) {     
                                        resp["Stock"] = await getStockMaster(params.ticker);
                                        resp["Portfolio"] = await getPortfolio(params.ticker);                                        
                                        resp["Sentiment"] = await getSentiment(params.ticker);
                                        resp["Trending"] = await getTrending(params.ticker);
        
                                        timedata["5m"] = await getTimeSeries('5m', params.ticker);
                                        price.push(timedata);

                                        timedata["30m"] = await getTimeSeries('30m', params.ticker);
                                        price.push(timedata);

                                        timedata["Daily"] = await getTimeSeries('Daily', params.ticker);
                                        price.push(timedata);

                                        timedata["Weekly"] = await getTimeSeries('Weekly', params.ticker);
                                        price.push(timedata);

                                        resp["Price"] = price;
                                        
                                    } else  {
                                        resp = await getStockList();
                                    }
                                
                                } else {
                                    throw new Error("Not authorized");
                                }
                            } else {
                                throw new Error("User not found found. Unable to perform operation");
                            }       

                        }, reject).then(function() {
                            resolve(resp);
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
    sql = "SELECT * FROM User WHERE username = '" + userid + "'";
    return executeQuery(sql);
}

function getWatchList(username) {
   

    sql = "(SELECT s.coverage,s.reach,s.bullish,s.bearish,s.category,sm.*,CASE WHEN w.ticker IS NULL THEN false ELSE true END AS watchlist \
            FROM Stock s \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker AND s.category = 'Portfolio' \
            INNER JOIN Watchlist w on s.ticker = w.ticker AND w.username = '" + userid + "' \
            limit 100) UNION ALL \
          (SELECT s.coverage,s.reach,s.bullish,s.bearish,s.category,sm.*,CASE WHEN w.ticker IS NULL THEN false ELSE true END AS watchlist \
            FROM Stock s \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Sentiment' \
            INNER JOIN Watchlist w on s.ticker = w.ticker AND w.username = '" + userid + "'\
            limit 100) UNION ALL \
           (SELECT s.coverage,s.reach,s.bullish,s.bearish,s.category,sm.*,CASE WHEN w.ticker IS NULL THEN false ELSE true END AS watchlist \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            INNER JOIN Watchlist w on s.ticker = w.ticker AND w.username = '" + userid + "'\
            limit 100)"
          
           
    return executeQuery(sql);
}

function getStockList() {
    sql = "(SELECT s.coverage,s.reach,s.bullish,s.bearish,s.category,sm.*,CASE WHEN w.ticker IS NULL THEN false ELSE true END AS watchlist \
            FROM Stock s \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker AND s.category = 'Portfolio' \
            LEFT OUTER JOIN fintwit.Watchlist w on s.ticker = w.ticker AND w.username = '" + userid + "'\
            limit 100) UNION ALL \
          (SELECT s.coverage,s.reach,s.bullish,s.bearish,s.category,sm.*,CASE WHEN w.ticker IS NULL THEN false ELSE true END AS watchlist \
            FROM Stock s \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Sentiment' \
            LEFT OUTER JOIN Watchlist w on s.ticker = w.ticker AND w.username = '" + userid + "'\
            limit 100) UNION ALL \
           (SELECT s.coverage,s.reach,s.bullish,s.bearish,s.category,sm.*,CASE WHEN w.ticker IS NULL THEN false ELSE true END AS watchlist \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            LEFT OUTER JOIN Watchlist w on s.ticker = w.ticker AND w.username = '" + userid + "'\
            limit 100)"

    return executeQuery(sql);
}

function getTicker(params) {
    sql = "SELECT * FROM StockChart \
            WHERE ticker = '" + params.ticker + "'";
    return executeQuery(sql);
}

function getStockMaster(ticker) {
    sql = "SELECT sm.*, CASE WHEN w.ticker IS NULL THEN false ELSE true END AS watchlist \
            FROM Stock_Master sm \
            LEFT OUTER JOIN Watchlist w on sm.ticker = w.ticker AND w.username = '" + userid + "'\
            WHERE sm.ticker = '" + ticker + "' ";
    return executeQuery(sql);
}

function getPortfolio(ticker) {
    sql = "SELECT * FROM fintwit.StockChart \
            WHERE category = 'Portfolio' \
            AND ticker = '" + ticker + "' ";
    return executeQuery(sql);
}

function getSentiment(ticker) {
    sql = "SELECT * FROM fintwit.StockChart \
            WHERE category = 'Sentiment' \
            AND ticker = '" + ticker + "' ";
    return executeQuery(sql);
}

function getTrending(ticker) {
    sql = "SELECT * FROM fintwit.StockChart \
            WHERE category = 'Trending' \
            AND ticker = '" + ticker + "' ";
    return executeQuery(sql);
}

function getPrice(ticker) {
    sql = "SELECT * FROM Timeseries \
            WHERE ticker = '" + ticker + "'";
    return executeQuery(sql);
}

function getTimeSeries(granularity, ticker) {
    timedata = new Object();

    sql = "SELECT * FROM Timeseries \
            WHERE granularity = '"+ granularity + "' \
            AND ticker = '" + ticker + "'";
    return executeQuery(sql);
}