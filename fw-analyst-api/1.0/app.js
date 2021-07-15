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

                        switch(params.method) {
                            case 'search':
                                if (!isEmpty(params.term)) {
                                    resp = await searchAnalyst(params.term);

                                } else {
                                    throw new Error("Missing term parameter for search method.");
                                }
                                
                            break;
    
                            case 'feed':
                                if (params.ticker == 'ALL_TICKER' && params.analyst == 'ALL_ANALYST') {
                                    resp = await getAllTickerAllAnalyst();
    
                                } else if (params.ticker == 'ALL_TICKER' && params.analyst == 'FOLLOW_ANALYST') {
                                    resp = await getAllTickerFollowedAnalyst();
    
                                } else if (params.analyst == 'ALL_ANALYST' && params.ticker != 'PORTFOLIO_TICKER' && params.ticker != 'WATCHLIST_TICKER' ) {
                                    resp = await getTickerAllAnalyst(params.ticker);
    
                                } else if (params.analyst == 'FOLLOW_ANALYST'  && params.ticker != 'PORTFOLIO_TICKER' && params.ticker != 'WATCHLIST_TICKER') {
                                    resp = await getTickerFollowedAnalyst(params.ticker);
                                    
                                } else if (params.ticker == 'PORTFOLIO_TICKER' && params.analyst == 'ALL_ANALYST') {
                                    resp = await getPortfolioTickerAllAnalyst();

                                } else if (params.ticker == 'PORTFOLIO_TICKER' && params.analyst == 'FOLLOW_ANALYST') {
                                    resp = await getPortfolioTickerFollowedAnalyst();

                                } else if (params.ticker == 'WATCHLIST_TICKER' && params.analyst == 'ALL_ANALYST') {
                                    resp = await getWatchListTickerAllAnalyst();

                                } else if (params.ticker == 'WATCHLIST_TICKER' && params.analyst == 'FOLLOW_ANALYST') {
                                    resp = await getWatchListTickerFollowedAnalyst();

                                } else {
                                    throw new Error("Unsupported method for feed.");
                                }

                            break;
    

                            case 'insight':
                                if (params.analyst == 'ALL_ANALYST') {
                                    resp["followers"] = await getFollowerCount();                                    
                                    resp["activities"] = await getActivity();                                    
                                    resp["holdings"] = await getHoldings();                                    
                                    resp["mentions"] = await getMentions();                                    
                                    resp["buys"] = await getTopBuysStocks();   
                                    resp["sells"] = await getTopSellsStocks();                                 
                                    resp["conversations"] = await getConversations();

                                } else if (params.analyst == 'FOLLOW_ANALYST') {
                                    resp["followers"] = await getFollowFollowerCount();                                    
                                    resp["activities"] = await getFollowActivity();                                    
                                    resp["holdings"] = await getFollowHoldings();                                    
                                    resp["mentions"] = await getFollowMentions();                                    
                                    resp["buys"] = await getFollowTopBuysStocks();   
                                    resp["sells"] = await getFollowTopSellsStocks();                                  
                                    resp["conversations"] = await getFollowConversations();

                                } else {
                                    throw new Error("Missing/incorrect analyst parameter for insight method.");
                                }

                            break;
    
                            case 'profile':
                                let analyst = params.analyst;

                                if (isEmpty(analyst)) {
                                    throw new Error("Missing analyst data for profile method."); 

                                } else {
                                    resp["bio"] = await getAnalystBio(analyst);
                                    resp["holdings"] = await getAnalystHoldings(analyst);
                                    resp["mentions"] = await getAnalystMentions(analyst); 
                                    resp["trades"] = await getTopTradesStocks(analyst);   
                                    resp["conversations"] = await getAnalystConversations(analyst);
                                }

                            break;
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

function searchAnalyst(term) {
    sql = "SELECT  tUserID, profilePicMini, tUserName FROM Analyst \
            WHERE isActive = 'Y' AND LOWER(tUserName) \
            LIKE '" + term + "%' \
            OR LOWER(tUserName) LIKE '" + term + "%' ";

    return executeQuery(sql);
}

function getAllTickerAllAnalyst() {
    sql = "SELECT c.date,c.ticker, c.tUserID, c.tUserName, a.name, \
            a.profilePicMini, c.tweet, \
            CONCAT('https://twitter.com/',c.tUserName,'/status/',c.tweetID) as 'tweetLink'\
            FROM Conversation c \
            INNER JOIN Analyst a on c.tUserID = a.tUserID \
            ORDER BY c.date DESC  \
            LIMIT 100";

    return executeQuery(sql);
}

function getAllTickerFollowedAnalyst() {
    sql = "SELECT c.date,c.ticker, c.tUserID, c.tUserName, \
            a.name, a.profilePicMini, c.tweet, \
            CONCAT('https://twitter.com/',c.tUserName,'/status/',c.tweetID) as 'tweetLink' \
            FROM Conversation c \
            INNER JOIN Analyst a ON c.tUserID = a.tUserID \
            WHERE a.tUserID IN ( \
                SELECT f.value FROM Watchlist f \
                WHERE f.category = 'Analyst' AND f.username = '" + userid + "') \
            ORDER BY c.date DESC \
            LIMIT 100";
    
    return executeQuery(sql);
}

function getTickerAllAnalyst(ticker) {
    sql = "SELECT c.date,c.ticker, c.tUserID, c.tUserName, a.name, \
            a.profilePicMini, c.tweet, \
            CONCAT('https://twitter.com/',c.tUserName,'/status/',c.tweetID) as 'tweetLink' \
            FROM Conversation c \
            INNER JOIN Analyst a on c.tUserID = a.tUserID \
            WHERE c.ticker = '" + ticker + "' \
            ORDER BY c.date DESC \
            LIMIT 100";

    return executeQuery(sql);
}


function getTickerFollowedAnalyst(ticker) {
    sql = "SELECT c.date,c.ticker, c.tUserName,a.name, \
            a.profilePicMini,c.tweet, \
            CONCAT('https://twitter.com/',c.tUserName,'/status/',c.tweetID) as 'tweetLink' \
            FROM Conversation c \
            INNER JOIN Analyst a ON c.tUserID = a.tUserID \
            WHERE a.tUserID IN ( \
                SELECT f.value FROM Watchlist f \
                WHERE f.category = 'Analyst' AND f.username = '" + userid + "') \
            AND c.ticker = '" + ticker + "' \
            ORDER BY c.date DESC \
            LIMIT 100";

    return executeQuery(sql);
}

function getPortfolioTickerAllAnalyst() {
    sql = "SELECT c.date,c.ticker, c.tUserID, c.tUserName, \
            a.name, a.profilePicMini, c.tweet, \
            CONCAT('https://twitter.com/',c.tUserName,'/status/',c.tweetID) as 'tweetLink' \
            FROM Conversation c \
            INNER JOIN Analyst a on c.tUserID = a.tUserID \
            WHERE c.ticker IN ( \
                SELECT p.value FROM Watchlist p \
                WHERE p.category = 'Portfolio' AND p.username = '" + userid + "') \
            ORDER BY c.date DESC \
            LIMIT 100";
            
    return executeQuery(sql);
}

function getPortfolioTickerFollowedAnalyst() {
    sql = "SELECT c.date,c.ticker, c.tUserID, c.tUserName, \
            a.name, a.profilePicMini, c.tweet, \
            CONCAT('https://twitter.com/',c.tUserName,'/status/',c.tweetID) as 'tweetLink' \
            FROM Conversation c \
            INNER JOIN Analyst a on c.tUserID = a.tUserID \
            WHERE c.ticker IN ( \
                SELECT p.value FROM Watchlist p \
                WHERE p.category = 'Portfolio' AND p.username = '" + userid + "') AND \
            a.tUserID IN (SELECT f.value FROM Watchlist f WHERE f.category = 'Analyst' AND f.username = '" + userid + "') \
            ORDER BY c.date DESC \
            LIMIT 100";

    return executeQuery(sql);
}

function getWatchListTickerAllAnalyst() {
    sql = "SELECT c.date,c.ticker, c.tUserID, c.tUserName, \
            a.name, a.profilePicMini, c.tweet, \
            CONCAT('https://twitter.com/',c.tUserName,'/status/',c.tweetID) as 'tweetLink' \
            FROM Conversation c \
            INNER JOIN Analyst a on c.tUserID = a.tUserID \
            WHERE c.ticker IN ( \
                SELECT w.value FROM Watchlist w \
                WHERE w.category = 'Watchlist' AND w.username = '" + userid + "') \
            ORDER BY c.date DESC \
            LIMIT 100";

    return executeQuery(sql);
}

function getWatchListTickerFollowedAnalyst() {
    sql = "SELECT c.date,c.ticker, c.tUserID, c.tUserName, \
            a.name, a.profilePicMini, c.tweet, \
            CONCAT('https://twitter.com/',c.tUserName,'/status/',c.tweetID) as 'tweetLink' \
            FROM Conversation c \
            INNER JOIN Analyst a on c.tUserID = a.tUserID \
            WHERE c.ticker IN ( \
                SELECT w.value FROM Watchlist w \
                WHERE w.category = 'Watchlist' AND w.username = '" + userid + "') AND \
            a.tUserID IN ( \
                SELECT f.value FROM Watchlist f \
                WHERE f.category = 'Analyst' AND f.username = '" + userid + "') \
            ORDER BY c.date DESC \
            LIMIT 100";

    return executeQuery(sql);
}

function getFollowerCount() {
    sql = "SELECT tUserID, tUserName,name,description, \
            profilePicMini,followerCount, CONCAT('https://twitter.com/',tUserName) as 'twitterID' \
            FROM Analyst ORDER BY  followerCount desc LIMIT 100";

    return executeQuery(sql);            
}

function getActivity() {
    sql = "SELECT c.tUserID, c.tUserName,a.name,a.description, \
            a.profilePicMini, a.followerCount, \
            CONCAT('https://twitter.com/',c.tUserName) as 'twitterID', SUM(c.count) as posts \
            FROM Conversation_Master c \
            INNER JOIN Analyst a ON c.tUserID = a.tUserID \
            WHERE c.granularity = 'daily' \
            GROUP BY c.tUserName \
            ORDER BY posts desc LIMIT 100";

    return executeQuery(sql);   
}

function getHoldings() {

    sql = "SELECT s.category,ROW_NUMBER() OVER (ORDER BY s.holding DESC ) AS tickerRank, s.holding,sm.ticker,sm.company,sm.sector,sm.marketCap,ROUND(sm.Price,2) as Price,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
            FROM Stock s \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker AND s.category = 'Portfolio' \
            LEFT OUTER JOIN Watchlist w on s.ticker = w.value AND w.username = '" + userid + "'\
            where sm.isActive != 'N'\
            limit 100";

    return executeQuery(sql);
}

function getMentions() {
    sql = "SELECT c.ticker, SUM(c.count) as mentions \
            FROM Conversation_Master c \
            WHERE c.granularity = 'daily'  and c.date > CURDATE() - 3 \
            GROUP BY c.ticker \
            ORDER BY mentions desc \
            LIMIT 20";

    return executeQuery(sql);
}




// Recent trades
function getTopTradesStocks(analyst) {

    sql = "SELECT pt.class,pt.ticker,pt.lastMentioned,pt.dateAdded,CONCAT('https://twitter.com/',a.tUserName,'/status/',pt.tweetID) as 'tweetLink' \
           FROM  Portfolio_Trades pt \
           INNER JOIN Analyst a on pt.tUserID = a.tUserID\
           WHERE pt.class in ('BOUGHT','SOLD','PARTIALSOLD') and pt.tUserID =  '" + analyst + "' \
           ORDER BY pt.lastMentioned DESC \
           LIMIT 50";

    return executeQuery(sql);            
}

function getTopBuysStocks() {

    sql = "SELECT pt.ticker,count(pt.ticker) \
           FROM  Portfolio_Trades pt \
           WHERE pt.class = 'BOUGHT' AND CAST(pt.lastMentioned as Date) >= (SELECT MAX(CAST(lastMentioned as Date)) - INTERVAL 3 DAY FROM Portfolio_Trades) \
           GROUP BY pt.ticker \
           ORDER BY count(pt.ticker) DESC \
           LIMIT 20";

    return executeQuery(sql);            
}



function getTopSellsStocks() {
    
    sql = "SELECT pt.ticker,count(pt.ticker) \
           FROM  Portfolio_Trades pt \
           WHERE pt.class in ('SOLD','PARTIALSOLD') AND CAST(pt.lastMentioned as Date) >= (SELECT MAX(CAST(lastMentioned as Date)) - INTERVAL 3 DAY FROM Portfolio_Trades) \
           GROUP BY pt.ticker \
           ORDER BY count(pt.ticker) DESC \
           LIMIT 20";

    return executeQuery(sql);            
}


function getConversations() {
    sql = "SELECT cm.ticker,cm.Date, SUM(cm.count) cCount \
            FROM Conversation_Master cm \
            INNER JOIN (SELECT c.ticker, SUM(c.count) as mentions \
            FROM Conversation_Master c \
            WHERE c.granularity = 'daily'  and c.date > CURDATE() - 7 \
            GROUP BY c.ticker \
            ORDER BY mentions desc LIMIT 20) top20 on cm.ticker = top20.ticker \
            WHERE cm.granularity = 'daily' and cm.Date > CURDATE() - 30 \
            GROUP BY cm.ticker, cm.Date \
            ORDER BY cm.ticker desc, Date desc";
    
    return executeQuery(sql); 
}


function getFollowFollowerCount() {
    sql = "SELECT a.tUserID, a.tUserName,a.name,a.description, a.profilePicMini,a.followerCount, CONCAT('https://twitter.com/',a.tUserName) as 'twitterID' \
            FROM Analyst a \
            INNER JOIN Watchlist w on a.tUserID = w.value AND w.category = 'Analyst' AND w.username = '" + userid + "' \
            ORDER BY  a.followerCount desc LIMIT 100";

    return executeQuery(sql);            
}

function getFollowActivity() {
    sql = "SELECT c.tUserID, c.tUserName,a.name,a.description, \
            a.profilePicMini, a.followerCount, \
            CONCAT('https://twitter.com/',c.tUserName) as 'twitterID', SUM(c.count) as posts \
            FROM Conversation_Master c \
            INNER JOIN Analyst a ON c.tUserID = a.tUserID \
            INNER JOIN Watchlist w on a.tUserID = w.value AND w.category = 'Analyst' AND w.username = '" + userid + "' \
            WHERE c.granularity = 'daily' \
            GROUP BY c.tUserName \
            ORDER BY posts desc LIMIT 100";

    return executeQuery(sql);   
}

function getFollowHoldings() {

    sql = "SELECT pm.ticker, count(pm.tUserID), ROW_NUMBER() OVER (ORDER BY Count(pm.ticker) DESC),CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
            FROM Portfolio_Master pm \
            INNER JOIN Stock_Master sm on pm.ticker = sm.ticker \
            INNER JOIN Watchlist aw on pm.tUserID = aw.value AND aw.category = 'Analyst' AND aw.username = '" + userid + "' \
            LEFT OUTER JOIN Watchlist w on pm.ticker = w.value AND w.username = '" + userid + "' \
            WHERE sm.isActive != 'N'\
            GROUP BY pm.ticker \
            limit 100";

    return executeQuery(sql);
}

function getFollowMentions() {
    sql = "SELECT c.ticker, SUM(c.count) as mentions \
            FROM Conversation_Master c \
            INNER JOIN Watchlist w on c.tUserID = w.value AND w.category = 'Analyst' AND w.username = '" + userid + "' \
            WHERE c.granularity = 'daily'  and c.date > CURDATE() - 3 \
            GROUP BY c.ticker \
            ORDER BY mentions desc \
            LIMIT 20";

    return executeQuery(sql);
}


function getFollowTopBuysStocks() {

    sql = "SELECT pt.ticker,count(pt.ticker) \
           FROM Portfolio_Trades pt \
           INNER JOIN Watchlist w on pt.tUserID = w.value AND w.category = 'Analyst' AND w.username = '" + userid + "' \
           WHERE pt.class = 'BOUGHT' AND CAST(pt.lastMentioned as Date) >= (SELECT MAX(CAST(lastMentioned as Date)) - INTERVAL 3 DAY FROM Portfolio_Trades) \
           GROUP BY pt.ticker \
           ORDER BY count(pt.ticker) DESC \
           LIMIT 20";


    return executeQuery(sql);            
}

function getFollowTopSellsStocks() {

    sql = "SELECT pt.ticker,count(pt.ticker) \
           FROM Portfolio_Trades pt \
           INNER JOIN Watchlist w on pt.tUserID = w.value AND w.category = 'Analyst' AND w.username = '" + userid + "' \
           WHERE pt.class in ('SOLD','PARTIALSOLD') AND CAST(pt.lastMentioned as Date) >= (SELECT MAX(CAST(lastMentioned as Date)) - INTERVAL 3 DAY FROM Portfolio_Trades) \
           GROUP BY pt.ticker \
           ORDER BY count(pt.ticker) DESC \
           LIMIT 20";

    return executeQuery(sql);            
}




function getFollowConversations() {
    sql = "SELECT cm.ticker,cm.Date, SUM(cm.count) cCount \
            FROM Conversation_Master cm \
            INNER JOIN Watchlist w on cm.tUserID = w.value AND w.category = 'Analyst' AND w.username = '" + userid + "' \
            INNER JOIN (SELECT c.ticker, SUM(c.count) as mentions \
            FROM Conversation_Master c \
            WHERE c.granularity = 'daily'  and c.date > CURDATE() - 7 \
            GROUP BY c.ticker \
            ORDER BY mentions desc LIMIT 20) top20 on cm.ticker = top20.ticker \
            WHERE cm.granularity = 'daily' and cm.Date > CURDATE() - 30 \
            GROUP BY cm.ticker, cm.Date \
            ORDER BY cm.ticker desc, Date desc";
    
    return executeQuery(sql); 
}


function getAnalystBio(analyst) {
    sql = "SELECT tUserID, tUserName,name, \
            profilePicMini,description, followerCount, \
            CONCAT('https://twitter.com/',tUserName) as 'twitterID' FROM Analyst \
            WHERE tUserID = '" + analyst + "'";

    return executeQuery(sql);     
}

function getAnalystHoldings(analyst) {
    sql = "SELECT p.ticker,CASE WHEN w.category = 'Watchlist' \
            THEN true ELSE false END AS watchlist, \
            CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
            FROM fintwit.Portfolio_Master p \
            INNER JOIN fintwit.Analyst a on p.tUserID = a.tUserID AND a.tUserID = '" + analyst + "' \
            LEFT OUTER JOIN fintwit.Watchlist w on p.ticker = w.value AND w.username = '" + userid + "' \
            ORDER BY p.ticker desc \
            LIMIT 50";
    
    return executeQuery(sql);
}

function getAnalystMentions(analyst) {
    sql = "SELECT c.ticker, \
            (SUM(c.count)*100/(Select SUM(cm.count) \
            from Conversation_Master cm \
            where cm.granularity = 'daily' and cm.tUserID =  '" + analyst + "' )) as 'Perc' \
            FROM Conversation_Master c \
            INNER JOIN Analyst a ON c.tUserID = a.tUserID AND a.tUserID =  '" + analyst + "' \
            WHERE c.granularity = 'daily' and c.date > CURDATE() - 7 \
            GROUP BY c.ticker \
            ORDER BY Perc desc \
            LIMIT 20";

    return executeQuery(sql);   
}

function getAnalystConversations(analyst) {
    sql = "SELECT c.date,c.ticker, c.tUserID, \
            c.tUserName, a.name, a.profilePicMini, \
            c.tweet, CONCAT('https://twitter.com/',a.name,'/status/',c.tweetID) as 'tweetLink' \
            FROM Conversation c \
            INNER JOIN Analyst a ON c.tUserID = a.tUserID AND a.tUserID = '" + analyst + "' \
            ORDER BY c.date DESC \
            LIMIT 100";
    
    return executeQuery(sql);  
}