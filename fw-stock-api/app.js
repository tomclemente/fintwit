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
var timedata = new Object();

var timeseries = {
    '5m': [],
    '30m': [],
    'Daily': [],
    'Weekly': []
};

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
                                resp = new Object();

                                if  (data[0].subscriptionStatus == 'ACTIVE' || data[0].subscriptionStatus == 'TRIALING' || data[0].subscriptionStatus == 'MANUALLY_CANCELLED'){
                                    
                                    if (!isEmpty(params) && params.watchlist == 'Y') {
                                        resp = await getWatchList(data[0].username);

                                    } else if (!isEmpty(params) && params.analyst == 'Y') {
                                        resp = await getAnalystStocks(data[0].username);

                                    }else if (!isEmpty(params) && !isEmpty(params.search)) {
                                        resp = await getSearchList(params.search);
                                    

                                    } else if (!isEmpty(params) && !isEmpty(params.ticker)) {     
                                        var result = await getStockMaster(params.ticker);
                                        resp = result[0];
                                        resp["Holding"] = await getHolding(params.ticker);                                        
                                        resp["Sentiment"] = await getSentiment(params.ticker);
                                        resp["Trending"] = await getTrending(params.ticker);
                                        resp["Mention"] = await getMention(params.ticker);
                                        resp["Tweets"] = await getTweet(params.ticker);
                                        resp["Investors"] = await getInvestors(params.ticker);
                                        resp["Influencers"] = await getInfluencers(params.ticker);
                                        resp["News"] = await getNews(params.ticker);


                                        timedata = await getTimeSeries('5m', params.ticker);
                                        timeseries['5m'] = timedata;

                                        timedata = await getTimeSeries('30m', params.ticker);
                                        timeseries['30m'] = timedata;

                                        timedata = await getTimeSeries('Daily', params.ticker);
                                        timeseries['Daily'] = timedata;

                                        timedata = await getTimeSeries('Weekly', params.ticker);
                                        timeseries['Weekly'] = timedata;

                                        resp["Timeseries"] = timeseries;
                                        
                                    } else  {
                                        resp = await getStockList();
                                    }
                                
                                } else if (data[0].subscriptionStatus == 'INCOMPLETE' || data[0].subscriptionStatus == 'PAYMENT_FAILED') {
                                    resp = await getUser3DCardInfo();

                                } else {
                                    throw new Error("Not authorized");
                                }
                            } else {
                                throw new Error("User not found");
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

function getUser3DCardInfo() {
    sql = "SELECT clientSecretKey, CASE WHEN actionRequired = 1 THEN true ELSE false END AS actionRequired FROM User WHERE username = '" + userid + "'";
    return executeQuery(sql);
}

function getUser() {
    sql = "SELECT * FROM User WHERE username = '" + userid + "'";
    return executeQuery(sql);
}

function getSearchList(search) {
   

    sql = "SELECT ticker, company \
            FROM Stock_Master \
            where isActive != 'N' AND LOWER(ticker) LIKE '" + search + "%' OR LOWER(company) LIKE '" + search + "%'";
          
    return executeQuery(sql);
}
function getAnalystStocks(username) {
   
   sql = "(SELECT s.coverage,s.reach,s.bullish,s.bearish,s.neutral,s.category,s.trendingScore, s.trendingScoreChange, s.sScore, s.sScoreChange,s.holding,s.holdingChange,s.holdingChangePerc,sm.*,CASE WHEN w.ticker IS NULL THEN false ELSE true END AS watchlist \
            FROM Stock s \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker AND s.category = 'Portfolio' \
            INNER JOIN Watchlist w on s.ticker = w.ticker AND w.username = '" + userid + "'\
            where sm.isActive != 'N'\
            order by s.holding desc limit 200) UNION ALL \
           (SELECT s.coverage,s.reach,s.bullish,s.bearish,s.neutral,s.category,s.trendingScore, s.trendingScoreChange, s.sScore, s.sScoreChange,s.holding,s.holdingChange,s.holdingChangePerc,sm.*,CASE WHEN w.ticker IS NULL THEN false ELSE true END AS watchlist \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            INNER JOIN Watchlist w on s.ticker = w.ticker AND w.username = '" + userid + "'\
            where sm.isActive != 'N'\
            order by s.trendingScore desc limit 200) UNION ALL \
           (SELECT s.coverage,s.reach,s.bullish,s.bearish,s.neutral,'Sentiment' AS 'category',s.trendingScore, s.trendingScoreChange, s.sScore, s.sScoreChange,s.holding,s.holdingChange,s.holdingChangePerc,sm.*,CASE WHEN w.ticker IS NULL THEN false ELSE true END AS watchlist \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            INNER JOIN Watchlist w on s.ticker = w.ticker AND w.username = '" + userid + "'\
            where sm.isActive != 'N'\
            order by s.sScore desc limit 200)"

          
           
    return executeQuery(sql);
}

function getWatchList(username) {
   
   sql = "(SELECT s.coverage,s.reach,s.bullish,s.bearish,s.neutral,s.category,s.trendingScore, s.trendingScoreChange, s.sScore, s.sScoreChange,s.holding,s.holdingChange,s.holdingChangePerc,sm.*,CASE WHEN w.ticker IS NULL THEN false ELSE true END AS watchlist \
            FROM Stock s \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker AND s.category = 'Portfolio' \
            INNER JOIN Watchlist w on s.ticker = w.ticker AND w.username = '" + userid + "'\
            where sm.isActive != 'N'\
            order by s.holding desc limit 200) UNION ALL \
           (SELECT s.coverage,s.reach,s.bullish,s.bearish,s.neutral,s.category,s.trendingScore, s.trendingScoreChange, s.sScore, s.sScoreChange,s.holding,s.holdingChange,s.holdingChangePerc,sm.*,CASE WHEN w.ticker IS NULL THEN false ELSE true END AS watchlist \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            INNER JOIN Watchlist w on s.ticker = w.ticker AND w.username = '" + userid + "'\
            where sm.isActive != 'N'\
            order by s.trendingScore desc limit 200) UNION ALL \
           (SELECT s.coverage,s.reach,s.bullish,s.bearish,s.neutral,'Sentiment' AS 'category',s.trendingScore, s.trendingScoreChange, s.sScore, s.sScoreChange,s.holding,s.holdingChange,s.holdingChangePerc,sm.*,CASE WHEN w.ticker IS NULL THEN false ELSE true END AS watchlist \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            INNER JOIN Watchlist w on s.ticker = w.ticker AND w.username = '" + userid + "'\
            where sm.isActive != 'N'\
            order by s.sScore desc limit 200)"

          
           
    return executeQuery(sql);
}
//comment
function getStockList() {
    sql = "(SELECT s.coverage,s.reach,s.bullish,s.bearish,s.neutral,s.category,s.trendingScore, s.trendingScoreChange, s.sScore, s.sScoreChange,s.holding,s.holdingChange,s.holdingChangePerc,sm.*,CASE WHEN w.ticker IS NULL THEN false ELSE true END AS watchlist \
            FROM Stock s \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker AND s.category = 'Portfolio' \
            LEFT OUTER JOIN Watchlist w on s.ticker = w.ticker AND w.username = '" + userid + "'\
            where sm.isActive != 'N'\
            order by s.holding desc limit 200) UNION ALL \
           (SELECT s.coverage,s.reach,s.bullish,s.bearish,s.neutral,s.category,s.trendingScore, s.trendingScoreChange, s.sScore, s.sScoreChange,s.holding,s.holdingChange,s.holdingChangePerc,sm.*,CASE WHEN w.ticker IS NULL THEN false ELSE true END AS watchlist \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            LEFT OUTER JOIN Watchlist w on s.ticker = w.ticker AND w.username = '" + userid + "'\
            where sm.isActive != 'N'\
            order by s.trendingScore desc limit 200) UNION ALL \
           (SELECT s.coverage,s.reach,s.bullish,s.bearish,s.neutral,'Sentiment' AS 'category',s.trendingScore, s.trendingScoreChange, s.sScore, s.sScoreChange,s.holding,s.holdingChange,s.holdingChangePerc,sm.*,CASE WHEN w.ticker IS NULL THEN false ELSE true END AS watchlist \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            LEFT OUTER JOIN Watchlist w on s.ticker = w.ticker AND w.username = '" + userid + "'\
            where sm.isActive != 'N'\
            order by s.sScore desc limit 200)"

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
            WHERE sm.isActive != 'N' and sm.ticker = '" + ticker + "' ";
    return executeQuery(sql);
}

function getHolding(ticker) {
    sql = "SELECT ticker,date,holding FROM StockChart\
            WHERE category = 'Portfolio' \
            AND ticker = '" + ticker + "' LIMIT 60";
    return executeQuery(sql);
}

function getSentiment(ticker) {
    sql = "SELECT ticker,date,sScore FROM StockChart\
            WHERE category = 'Trending' \
            AND ticker = '" + ticker + "' LIMIT 60";
    return executeQuery(sql);
}

function getTrending(ticker) {
    sql = "SELECT ticker,date,trendingScore FROM StockChart\
            WHERE category = 'Trending' \
            AND ticker = '" + ticker + "' LIMIT 60";
    return executeQuery(sql);
}

function getMention(ticker) {

    sql = "SELECT date,SUM(count)\
            FROM Conversation_Master\
            WHERE granularity = 'daily' AND ticker = '" + ticker + "' GROUP BY date";
    return executeQuery(sql);
}

function getTweet(ticker) {

    sql = "SELECT c.date,c.tUserName,a.name,a.profilePicMini,c.tweet,CONCAT('https://twitter.com/',a.name,'/status/',c.tweetID) as 'tweetLink'\
            FROM Conversation c \
            INNER JOIN Analyst a on c.tUserID = a.tUserID\
            WHERE c.ticker = '" + ticker + "' \
            ORDER BY c.date DESC \
            LIMIT 100";
    return executeQuery(sql);
}

function getNews(ticker) {
    sql = "SELECT * from StockNews \
            WHERE ticker = '" + ticker + "' \
            ORDER BY timestamp DESC \
            LIMIT 50";

    return executeQuery(sql);
}


function getInfluencers(ticker) {

    sql = "SELECT c.tUserName,a.name,a.description,a.profilePicMini, (SUM(c.count)*100/(Select SUM(cm.count) from Conversation_Master cm where cm.granularity = 'daily' and cm.ticker = 'TSLA')) as 'Perc'\
           FROM Conversation_Master c \
           INNER JOIN Analyst a on c.tUserID = a.tUserID \
           WHERE c.granularity = 'daily' and c.ticker = '" + ticker + "' \
           GROUP BY c.tUserName \
           ORDER BY Perc desc \
           LIMIT 50";

    return executeQuery(sql);
}

function getInvestors(ticker) {
    sql = "SELECT a.tUserName,a.name,a.profilePicMini,p.dateAdded from Portfolio_Master p\
            INNER JOIN Analyst a on p.tUserID = a.tUserID \
            WHERE p.ticker = '" + ticker + "' \
            ORDER BY a.followerCount DESC \
            LIMIT 50";

    return executeQuery(sql);
}




function getTimeSeries(granularity, ticker) {
    sql = "SELECT t.* FROM Timeseries t\
            INNER JOIN Stock_Master sm on t.ticker = sm.ticker \
            WHERE sm.isActive != 'N' \
            AND t.granularity = '"+ granularity + "' \
            AND t.ticker = '" + ticker + "'";
    return executeQuery(sql);
}