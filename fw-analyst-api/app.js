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

                        switch(params.method) {
                            case 'search':
                                if (!isEmpty(term)) {
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
    
                                } else if (params.analyst == 'ALL_ANALYST') {
                                    resp = await getTickerAllAnalyst(params.ticker);
    
                                } else if (params.analyst == 'FOLLOW_ANALYST') {
                                    resp = await getTickerFollowedAnalyst(params.ticker);
                                    
                                } else if (params.ticker == 'PORTFOLIO' && params.analyst == 'ALL_ANALYST') {
                                    resp = await getPortfolioTickerAllAnalyst();

                                } else if (params.ticker == 'PORTFOLIO' && params.analyst == 'FOLLOW_ANALYST') {
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
                                if (params.analyst == 'FOLLOW_ANALYST') {
                                    resp["followers"] = await getFollowerCount();                                    
                                    resp["activities"] = await getActivity();                                    
                                    resp["holdings"] = await getHoldings();                                    
                                    resp["mentions"] = await getMentions();                                    
                                    resp["stocks"] = await getTradedStocks();                                    
                                    resp["conversations"] = await getConversations();

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
            CONCAT('https://twitter.com/',a.name,'/status/',c.tweetID) \
            FROM Conversation c \
            INNER JOIN Analyst a on c.tUserID = a.tUserID \
            ORDER BY c.date DESC  \
            LIMIT 100";

    return executeQuery(sql);
}

function getAllTickerFollowedAnalyst() {
    sql = "SELECT c.date,c.ticker, c.tUserID, c.tUserName, \
            a.name, a.profilePicMini, c.tweet, \
            CONCAT('https://twitter.com/',a.name,'/status/',c.tweetID) as 'tweetLink' \
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
            CONCAT('https://twitter.com/',a.name,'/status/',c.tweetID) as 'tweetLink' \
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
            CONCAT('https://twitter.com/',a.name,'/status/',c.tweetID) as 'tweetLink' \
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
            CONCAT('https://twitter.com/',a.name,'/status/',c.tweetID) as 'tweetLink' \
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
            CONCAT('https://twitter.com/',a.name,'/status/',c.tweetID) as 'tweetLink' \
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
            CONCAT('https://twitter.com/',a.name,'/status/',c.tweetID) as 'tweetLink' \
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
            CONCAT('https://twitter.com/',a.name,'/status/',c.tweetID) as 'tweetLink' \
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
            a.profilePicMini, followerCount, \
            CONCAT('https://twitter.com/',c.tUserName) as 'twitterID', SUM(c.count) as posts \
            FROM Conversation_Master c \
            INNER JOIN Analyst a ON c.tUserID = a.tUserID \
            WHERE c.granularity = 'daily' \
            GROUP BY c.tUserName \
            ORDER BY posts desc LIMIT 100";

    return executeQuery(sql);   
}

function getHoldings() {
    sql = "SELECT ticker, holding FROM fintwit.Stock ORDER BY holding desc LIMIT 100";
    return executeQuery(sql);
}

function getMentions() {
    sql = "SELECT c.ticker, SUM(c.count) as mentions \
            FROM Conversation_Master c \
            WHERE c.granularity = 'daily'  and c.date > CURDATE() - 7 \
            GROUP BY c.ticker \
            ORDER BY mentions desc \
            LIMIT 25";

    return executeQuery(sql);
}

function getTradedStocks() {
    sql = "SELECT ticker,COUNT(distinct pm.tUserID) as holding \
            FROM Portfolio_Master pm \
            WHERE dateAdded > CURDATE()-7 \
            GROUP BY pm.ticker \
            ORDER BY holding desc \
            LIMIT 25";

    return executeQuery(sql);            
}

function getConversations() {
    sql = "SELECT cm.ticker,cm.Date, SUM(cm.count) cCount \
            FROM Conversation_Master cm \
            INNER JOIN (SELECT c.ticker, SUM(c.count) as mentions \
            FROM Conversation_Master c \
            WHERE c.granularity = 'daily'  and c.date > CURDATE() - 7 \
            GROUP BY c.ticker \
            ORDER BY mentions desc LIMIT 25) top25 on cm.ticker = top25.ticker \
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