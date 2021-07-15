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
                                    
                                    if (!isEmpty(params) && params.watchlist == 'Y' && params.portfolio == 'Y' ) {
                                        resp["list"] = await getPWStocks(data[0].username);
                                        resp["hotstocks"] = await getPWHotStocks();
                                        resp["positive"] = await getPWPositive();
                                        resp["negative"] = await getPWNegative();
                                        resp["topholdings"] = await getPWTopHoldings();

                                    } else if (!isEmpty(params) && params.portfolio == 'Y') {
                                        resp["list"] = await getPortfolioStocks(data[0].username);
                                        resp["hotstocks"] = await getPortfolioHotStocks();
                                        resp["positive"] = await getPortfolioPositive();
                                        resp["negative"] = await getPortfolioNegative();
                                        resp["topholdings"] = await getPortfolioTopHoldings();

                                    } else if (!isEmpty(params) && params.watchlist == 'Y') {
                                        resp["list"] = await getWatchList(data[0].username);
                                        resp["hotstocks"] = await getWatchlistHotStocks();
                                        resp["positive"] = await getWatchlistPositive();
                                        resp["negative"] = await getWatchlistNegative();
                                        resp["topholdings"] = await getWatchlistTopHoldings();

                                    }else if (!isEmpty(params) && !isEmpty(params.search)) {
                                        resp = await getSearchList(params.search);
                                    
                                    } else if (!isEmpty(params) && !isEmpty(params.ticker)) {     
                                        var result = await getStockMaster(params.ticker);
                                        resp = result[0];
                                        resp["Holding"] = await getHolding(params.ticker);                                        
                                        resp["Sentiment"] = await getSentiment(params.ticker);
                                        resp["Trending"] = await getTrending(params.ticker);
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
                                        resp["list"] = await getStockList();   
                                        resp["hotstocks"] = await getStockHotStocks();
                                        resp["positive"] = await getStockPositive();
                                        resp["negative"] = await getStockNegative();
                                        resp["topholdings"] = await getStockTopHoldings();
                                    }
                                
                                } else if (data[0].subscriptionStatus == 'FREE') {

                                    if (!isEmpty(params) && params.watchlist == 'Y' && params.portfolio == 'Y' ) {
                                        resp["list"] = await getPWStocksFree(data[0].username);
                                        resp["hotstocks"] = await getPWHotStocksFree();
                                        resp["positive"] = await getPWPositiveFree();
                                        resp["negative"] = await getPWNegativeFree();
                                        resp["topholdings"] = await getPWTopHoldingsFree();

                                    } else if (!isEmpty(params) && params.portfolio == 'Y') {
                                        resp["list"] = await getPortfolioStocksFree(data[0].username);
                                        resp["hotstocks"] = await getPortfolioHotStocksFree();
                                        resp["positive"] = await getPortfolioPositiveFree();
                                        resp["negative"] = await getPortfolioNegativeFree();
                                        resp["topholdings"] = await getPortfolioTopHoldingsFree();

                                    } else if (!isEmpty(params) && params.watchlist == 'Y') {
                                        resp["list"] = await getWatchListFree(data[0].username);
                                        resp["hotstocks"] = await getWatchlistHotStocksFree();
                                        resp["positive"] = await getWatchlistPositiveFree();
                                        resp["negative"] = await getWatchlistNegativeFree();
                                        resp["topholdings"] = await getWatchlistTopHoldingsFree();

                                    } else if (!isEmpty(params) && !isEmpty(params.search)) {

                                        resp = await getSearchList(params.search);
                                    
                                    } else if (!isEmpty(params) && !isEmpty(params.ticker)) {     
                                        var result = await getStockMaster(params.ticker);
                                        resp = result[0];
                                        resp["Holding"] = await getHolding(params.ticker);                                        
                                        resp["Sentiment"] = await getSentiment(params.ticker);
                                        resp["Trending"] = await getTrending(params.ticker);
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
                                        resp["list"] = await getStockListFree();   
                                        resp["hotstocks"] = await getStockHotStocksFree();
                                        resp["positive"] = await getStockPositiveFree();
                                        resp["negative"] = await getStockNegativeFree();
                                        resp["topholdings"] = await getStockTopHoldingsFree();
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
   

    sql = "SELECT distinct t.ticker, t.company FROM (SELECT ticker, company \
            FROM Stock_Master \
            where isActive != 'N' AND LOWER(ticker) = '" + search + "' UNION ALL \
            SELECT ticker, company \
            FROM Stock_Master \
            where isActive != 'N' AND LOWER(ticker) LIKE '" + search + "%' UNION ALL \
            SELECT ticker, company \
            FROM Stock_Master \
            where isActive != 'N' AND LOWER(company) LIKE '" + search + "%') t";
          
    return executeQuery(sql);
}


function getPWStocksFree(username) {
   
   sql = "(SELECT 'Top Buys' AS 'category',ROW_NUMBER() OVER (ORDER BY Count(pt.ticker) DESC, pt.lastMentioned DESC ) AS tickerRank,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.52WeekHigh,sm.52WeekLow,ROUND(sm.Price,2) as Price,sm.50DMA,sm.200DMA,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,sm.lastUpdatedDate,sm.priceType,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
            FROM Portfolio_Trades pt \
            INNER JOIN Stock_Master sm on pt.ticker = sm.ticker \
            INNER JOIN Watchlist w on pt.ticker = w.value AND w.category in ('Portfolio','Watchlist') AND w.username = '" + userid + "' \
            where sm.isActive != 'N' and pt.class = 'BOUGHT' AND CAST(pt.lastMentioned as Date) >= (SELECT MAX(CAST(lastMentioned as Date)) - INTERVAL 3 DAY FROM Portfolio_Trades) \
            GROUP BY pt.ticker limit 5 ) UNION ALL \
            (SELECT 'Top Sells' AS 'category',ROW_NUMBER() OVER (ORDER BY Count(pt.ticker) DESC, pt.lastMentioned DESC ) AS tickerRank,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.52WeekHigh,sm.52WeekLow,ROUND(sm.Price,2) as Price,sm.50DMA,sm.200DMA,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,sm.lastUpdatedDate,sm.priceType,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
            FROM Portfolio_Trades pt \
            INNER JOIN Stock_Master sm on pt.ticker = sm.ticker \
            INNER JOIN Watchlist w on pt.ticker = w.value AND w.category in ('Portfolio','Watchlist') AND w.username = '" + userid + "' \
            where sm.isActive != 'N' and pt.class in ('SOLD','PARTIALSOLD') AND CAST(pt.lastMentioned as Date) >= (SELECT MAX(CAST(lastMentioned as Date)) - INTERVAL 3 DAY FROM Portfolio_Trades) \
            GROUP BY pt.ticker limit 5) UNION ALL \
           (SELECT s.category,ROW_NUMBER() OVER (ORDER BY s.trendingScore DESC ) AS tickerRank,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.52WeekHigh,sm.52WeekLow,ROUND(sm.Price,2) as Price,sm.50DMA,sm.200DMA,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,sm.lastUpdatedDate,sm.priceType, CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category in ('Portfolio','Watchlist') AND w.username = '" + userid + "'\
            where sm.isActive != 'N' limit 5)"

          
           
    return executeQuery(sql);
}




function getPWStocks(username) {
   
   sql = "(SELECT 'Top Buys' AS 'category',ROW_NUMBER() OVER (ORDER BY Count(pt.ticker) DESC, pt.lastMentioned DESC ) AS tickerRank,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.52WeekHigh,sm.52WeekLow,ROUND(sm.Price,2) as Price,sm.50DMA,sm.200DMA,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,sm.lastUpdatedDate,sm.priceType,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
            FROM Portfolio_Trades pt \
            INNER JOIN Stock_Master sm on pt.ticker = sm.ticker \
            INNER JOIN Watchlist w on pt.ticker = w.value AND w.category in ('Portfolio','Watchlist') AND w.username = '" + userid + "' \
            where sm.isActive != 'N' and pt.class = 'BOUGHT' AND CAST(pt.lastMentioned as Date) >= (SELECT MAX(CAST(lastMentioned as Date)) - INTERVAL 3 DAY FROM Portfolio_Trades) \
            GROUP BY pt.ticker limit 200 ) UNION ALL \
            (SELECT 'Top Sells' AS 'category',ROW_NUMBER() OVER (ORDER BY Count(pt.ticker) DESC, pt.lastMentioned DESC ) AS tickerRank,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.52WeekHigh,sm.52WeekLow,ROUND(sm.Price,2) as Price,sm.50DMA,sm.200DMA,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,sm.lastUpdatedDate,sm.priceType,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
            FROM Portfolio_Trades pt \
            INNER JOIN Stock_Master sm on pt.ticker = sm.ticker \
            INNER JOIN Watchlist w on pt.ticker = w.value AND w.category in ('Portfolio','Watchlist') AND w.username = '" + userid + "' \
            where sm.isActive != 'N' and pt.class in ('SOLD','PARTIALSOLD') AND CAST(pt.lastMentioned as Date) >= (SELECT MAX(CAST(lastMentioned as Date)) - INTERVAL 3 DAY FROM Portfolio_Trades) \
            GROUP BY pt.ticker limit 200) UNION ALL \
           (SELECT s.category,ROW_NUMBER() OVER (ORDER BY s.trendingScore DESC ) AS tickerRank,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.52WeekHigh,sm.52WeekLow,ROUND(sm.Price,2) as Price,sm.50DMA,sm.200DMA,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,sm.lastUpdatedDate,sm.priceType, CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category in ('Portfolio','Watchlist') AND w.username = '" + userid + "'\
            where sm.isActive != 'N' limit 200)"

          
           
    return executeQuery(sql);
}


function getPortfolioStocksFree(username) {
   
   sql = "(SELECT 'Top Buys' AS 'category',ROW_NUMBER() OVER (ORDER BY Count(pt.ticker) DESC, pt.lastMentioned DESC ) AS tickerRank,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.52WeekHigh,sm.52WeekLow,ROUND(sm.Price,2) as Price,sm.50DMA,sm.200DMA,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,sm.lastUpdatedDate,sm.priceType,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
           FROM Portfolio_Trades pt \
           INNER JOIN Stock_Master sm on pt.ticker = sm.ticker \
            INNER JOIN Watchlist w on pt.ticker = w.value AND w.category = 'Portfolio' AND w.username = '" + userid + "'\
           where sm.isActive != 'N' and pt.class = 'BOUGHT' AND CAST(pt.lastMentioned as Date) >= (SELECT MAX(CAST(lastMentioned as Date)) - INTERVAL 3 DAY FROM Portfolio_Trades) \
           GROUP BY pt.ticker limit 5) UNION ALL \
            (SELECT 'Top Sells' AS 'category',ROW_NUMBER() OVER (ORDER BY Count(pt.ticker) DESC, pt.lastMentioned DESC ) AS tickerRank,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.52WeekHigh,sm.52WeekLow,ROUND(sm.Price,2) as Price,sm.50DMA,sm.200DMA,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,sm.lastUpdatedDate,sm.priceType,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
             FROM Portfolio_Trades pt \
             INNER JOIN Stock_Master sm on pt.ticker = sm.ticker \
            INNER JOIN Watchlist w on pt.ticker = w.value AND w.category = 'Portfolio' AND w.username = '" + userid + "'\
             where sm.isActive != 'N' and pt.class in ('SOLD','PARTIALSOLD') AND CAST(pt.lastMentioned as Date) >= (SELECT MAX(CAST(lastMentioned as Date)) - INTERVAL 3 DAY FROM Portfolio_Trades) \
            GROUP BY pt.ticker limit 5) UNION ALL \
           (SELECT s.category,ROW_NUMBER() OVER (ORDER BY s.trendingScore DESC ) AS tickerRank,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.52WeekHigh,sm.52WeekLow,ROUND(sm.Price,2) as Price,sm.50DMA,sm.200DMA,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,sm.lastUpdatedDate,sm.priceType,false as watchlist, CASE WHEN w.value IS NULL THEN false ELSE true END AS portfolio \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category = 'Portfolio' AND w.username = '" + userid + "'\
            where sm.isActive != 'N' limit 5)"

          
           
    return executeQuery(sql);
}

function getPortfolioStocks(username) {
   
   sql = "(SELECT 'Top Buys' AS 'category',ROW_NUMBER() OVER (ORDER BY Count(pt.ticker) DESC, pt.lastMentioned DESC ) AS tickerRank,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.52WeekHigh,sm.52WeekLow,ROUND(sm.Price,2) as Price,sm.50DMA,sm.200DMA,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,sm.lastUpdatedDate,sm.priceType,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
           FROM Portfolio_Trades pt \
           INNER JOIN Stock_Master sm on pt.ticker = sm.ticker \
            INNER JOIN Watchlist w on pt.ticker = w.value AND w.category = 'Portfolio' AND w.username = '" + userid + "'\
           where sm.isActive != 'N' and pt.class = 'BOUGHT' AND CAST(pt.lastMentioned as Date) >= (SELECT MAX(CAST(lastMentioned as Date)) - INTERVAL 3 DAY FROM Portfolio_Trades) \
           GROUP BY pt.ticker limit 200) UNION ALL \
            (SELECT 'Top Sells' AS 'category',ROW_NUMBER() OVER (ORDER BY Count(pt.ticker) DESC, pt.lastMentioned DESC ) AS tickerRank,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.52WeekHigh,sm.52WeekLow,ROUND(sm.Price,2) as Price,sm.50DMA,sm.200DMA,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,sm.lastUpdatedDate,sm.priceType,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
             FROM Portfolio_Trades pt \
             INNER JOIN Stock_Master sm on pt.ticker = sm.ticker \
            INNER JOIN Watchlist w on pt.ticker = w.value AND w.category = 'Portfolio' AND w.username = '" + userid + "'\
             where sm.isActive != 'N' and pt.class in ('SOLD','PARTIALSOLD') AND CAST(pt.lastMentioned as Date) >= (SELECT MAX(CAST(lastMentioned as Date)) - INTERVAL 3 DAY FROM Portfolio_Trades) \
            GROUP BY pt.ticker limit 200) UNION ALL \
           (SELECT s.category,ROW_NUMBER() OVER (ORDER BY s.trendingScore DESC ) AS tickerRank,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.52WeekHigh,sm.52WeekLow,ROUND(sm.Price,2) as Price,sm.50DMA,sm.200DMA,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,sm.lastUpdatedDate,sm.priceType,false as watchlist, CASE WHEN w.value IS NULL THEN false ELSE true END AS portfolio \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category = 'Portfolio' AND w.username = '" + userid + "'\
            where sm.isActive != 'N' limit 200)"
           
    return executeQuery(sql);
}


function getWatchListFree(username) {
   
   sql = "(SELECT 'Top Buys' AS 'category',ROW_NUMBER() OVER (ORDER BY Count(pt.ticker) DESC, pt.lastMentioned DESC ) AS tickerRank,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.52WeekHigh,sm.52WeekLow,ROUND(sm.Price,2) as Price,sm.50DMA,sm.200DMA,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,sm.lastUpdatedDate,sm.priceType,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
           FROM Portfolio_Trades pt \
           INNER JOIN Stock_Master sm on pt.ticker = sm.ticker \
            INNER JOIN Watchlist w on pt.ticker = w.value AND w.category = 'Watchlist' AND w.username = '" + userid + "'\
           where sm.isActive != 'N' and pt.class = 'BOUGHT' AND CAST(pt.lastMentioned as Date) >= (SELECT MAX(CAST(lastMentioned as Date)) - INTERVAL 3 DAY FROM Portfolio_Trades) \
           GROUP BY pt.ticker limit 5 ) UNION ALL \
            (SELECT 'Top Sells' AS 'category',ROW_NUMBER() OVER (ORDER BY Count(pt.ticker) DESC, pt.lastMentioned DESC ) AS tickerRank,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.52WeekHigh,sm.52WeekLow,ROUND(sm.Price,2) as Price,sm.50DMA,sm.200DMA,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,sm.lastUpdatedDate,sm.priceType,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
           FROM Portfolio_Trades pt \
            INNER JOIN Stock_Master sm on pt.ticker = sm.ticker \
            INNER JOIN Watchlist w on pt.ticker = w.value AND w.category = 'Watchlist' AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and pt.class in ('SOLD','PARTIALSOLD') AND CAST(pt.lastMentioned as Date) >=(SELECT MAX(CAST(lastMentioned as Date)) - INTERVAL 3 DAY FROM Portfolio_Trades) \
            GROUP BY pt.ticker limit 5) UNION ALL \
           (SELECT s.category,ROW_NUMBER() OVER (ORDER BY s.trendingScore DESC ) AS tickerRank,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.52WeekHigh,sm.52WeekLow,ROUND(sm.Price,2) as Price,sm.50DMA,sm.200DMA,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,sm.lastUpdatedDate,sm.priceType,CASE WHEN w.value IS NULL THEN false ELSE true END AS watchlist, false as portfolio  \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category = 'Watchlist' AND w.username = '" + userid + "'\
            where sm.isActive != 'N' limit 5)"

          
           
    return executeQuery(sql);
}

function getWatchList(username) {
   
   sql = "(SELECT 'Top Buys' AS 'category',ROW_NUMBER() OVER (ORDER BY Count(pt.ticker) DESC, pt.lastMentioned DESC ) AS tickerRank,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.52WeekHigh,sm.52WeekLow,ROUND(sm.Price,2) as Price,sm.50DMA,sm.200DMA,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,sm.lastUpdatedDate,sm.priceType,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
           FROM Portfolio_Trades pt \
           INNER JOIN Stock_Master sm on pt.ticker = sm.ticker \
            INNER JOIN Watchlist w on pt.ticker = w.value AND w.category = 'Watchlist' AND w.username = '" + userid + "'\
           where sm.isActive != 'N' and pt.class = 'BOUGHT' AND CAST(pt.lastMentioned as Date) >= (SELECT MAX(CAST(lastMentioned as Date)) - INTERVAL 3 DAY FROM Portfolio_Trades) \
           GROUP BY pt.ticker limit 200 ) UNION ALL \
            (SELECT 'Top Sells' AS 'category',ROW_NUMBER() OVER (ORDER BY Count(pt.ticker) DESC, pt.lastMentioned DESC ) AS tickerRank,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.52WeekHigh,sm.52WeekLow,ROUND(sm.Price,2) as Price,sm.50DMA,sm.200DMA,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,sm.lastUpdatedDate,sm.priceType,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
           FROM Portfolio_Trades pt \
            INNER JOIN Stock_Master sm on pt.ticker = sm.ticker \
            INNER JOIN Watchlist w on pt.ticker = w.value AND w.category = 'Watchlist' AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and pt.class in ('SOLD','PARTIALSOLD') AND CAST(pt.lastMentioned as Date) >=(SELECT MAX(CAST(lastMentioned as Date)) - INTERVAL 3 DAY FROM Portfolio_Trades) \
            GROUP BY pt.ticker limit 200) UNION ALL \
           (SELECT s.category,ROW_NUMBER() OVER (ORDER BY s.trendingScore DESC ) AS tickerRank,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.52WeekHigh,sm.52WeekLow,ROUND(sm.Price,2) as Price,sm.50DMA,sm.200DMA,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,sm.lastUpdatedDate,sm.priceType,CASE WHEN w.value IS NULL THEN false ELSE true END AS watchlist, false as portfolio  \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category = 'Watchlist' AND w.username = '" + userid + "'\
            where sm.isActive != 'N' limit 200)"

          
           
    return executeQuery(sql);
}

//comment
function getStockList() {
    sql = "(SELECT 'Top Buys' AS 'category',ROW_NUMBER() OVER (ORDER BY Count(pt.ticker) DESC, pt.lastMentioned DESC ) AS tickerRank,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.52WeekHigh,sm.52WeekLow,ROUND(sm.Price,2) as Price,sm.50DMA,sm.200DMA,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,sm.lastUpdatedDate,sm.priceType,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
            FROM Portfolio_Trades pt \
            INNER JOIN Stock_Master sm on pt.ticker = sm.ticker \
            LEFT OUTER JOIN Watchlist w on pt.ticker = w.value AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and pt.class = 'BOUGHT' AND CAST(pt.lastMentioned as Date) >= (SELECT MAX(CAST(lastMentioned as Date)) - INTERVAL 3 DAY FROM Portfolio_Trades) \
            GROUP BY pt.ticker limit 300) UNION ALL \
            (SELECT 'Top Sells' AS 'category',ROW_NUMBER() OVER (ORDER BY Count(pt.ticker) DESC, pt.lastMentioned DESC ) AS tickerRank,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.52WeekHigh,sm.52WeekLow,ROUND(sm.Price,2) as Price,sm.50DMA,sm.200DMA,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,sm.lastUpdatedDate,sm.priceType,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
            FROM Portfolio_Trades pt  \
            INNER JOIN Stock_Master sm on pt.ticker = sm.ticker \
            LEFT OUTER JOIN Watchlist w on pt.ticker = w.value AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and pt.class in ('SOLD','PARTIALSOLD') AND CAST(pt.lastMentioned as Date) >= (SELECT MAX(CAST(lastMentioned as Date)) - INTERVAL 3 DAY FROM Portfolio_Trades) \
            GROUP BY pt.ticker limit 300) UNION ALL \
           (SELECT s.category,ROW_NUMBER() OVER (ORDER BY s.trendingScore DESC ) AS tickerRank,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.52WeekHigh,sm.52WeekLow,ROUND(sm.Price,2) as Price,sm.50DMA,sm.200DMA,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,sm.lastUpdatedDate,sm.priceType,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio  \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            LEFT OUTER JOIN Watchlist w on s.ticker = w.value AND w.username = '" + userid + "'\
            where sm.isActive != 'N' limit 300)"

    return executeQuery(sql);
}

function getStockListFree() {
    sql = "(SELECT 'Top Buys' AS 'category',ROW_NUMBER() OVER (ORDER BY Count(pt.ticker) DESC, pt.lastMentioned DESC ) AS tickerRank,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.52WeekHigh,sm.52WeekLow,ROUND(sm.Price,2) as Price,sm.50DMA,sm.200DMA,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,sm.lastUpdatedDate,sm.priceType,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
            FROM Portfolio_Trades pt \
            INNER JOIN Stock_Master sm on pt.ticker = sm.ticker \
            LEFT OUTER JOIN Watchlist w on pt.ticker = w.value AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and pt.class = 'BOUGHT' AND CAST(pt.lastMentioned as Date) >= (SELECT MAX(CAST(lastMentioned as Date)) - INTERVAL 3 DAY FROM Portfolio_Trades) \
            GROUP BY pt.ticker limit 5) UNION ALL \
            (SELECT 'Top Sells' AS 'category',ROW_NUMBER() OVER (ORDER BY Count(pt.ticker) DESC, pt.lastMentioned DESC ) AS tickerRank,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.52WeekHigh,sm.52WeekLow,ROUND(sm.Price,2) as Price,sm.50DMA,sm.200DMA,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,sm.lastUpdatedDate,sm.priceType,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
            FROM Portfolio_Trades pt  \
            INNER JOIN Stock_Master sm on pt.ticker = sm.ticker \
            LEFT OUTER JOIN Watchlist w on pt.ticker = w.value AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and pt.class in ('SOLD','PARTIALSOLD') AND CAST(pt.lastMentioned as Date) >= (SELECT MAX(CAST(lastMentioned as Date)) - INTERVAL 3 DAY FROM Portfolio_Trades) \
            GROUP BY pt.ticker limit 5) UNION ALL \
           (SELECT s.category,ROW_NUMBER() OVER (ORDER BY s.trendingScore DESC ) AS tickerRank,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.52WeekHigh,sm.52WeekLow,ROUND(sm.Price,2) as Price,sm.50DMA,sm.200DMA,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,sm.lastUpdatedDate,sm.priceType,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio  \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            LEFT OUTER JOIN Watchlist w on s.ticker = w.value AND w.username = '" + userid + "'\
            where sm.isActive != 'N' limit 5)"

    return executeQuery(sql);
}

function getTicker(params) {
    sql = "SELECT * FROM StockChart \
            WHERE ticker = '" + params.ticker + "'";
    return executeQuery(sql);
}

function getStockMaster(ticker) {
    sql = "SELECT h.holding, h.holdingChange, s.sScore,  s.trendingScore, CASE WHEN s.trendingScore > s2.trendingScore THEN 1 WHEN s.trendingScore < s2.trendingScore THEN -1 ELSE 0 END AS trendingChange,CASE WHEN s.sScore > s2.sScore THEN 1 WHEN s.sScore < s2.sScore THEN -1 ELSE 0 END AS sScoreChange, sm.ticker,sm.company,sm.industry,sm.exchange,sm.country,sm.currency,sm.sector,sm.marketCap,ROUND(sm.PERatio,2) as PERatio,sm.DividendYield*100 as DividendYield,sm.EPS,sm.52WeekHigh,sm.52WeekLow, ROUND(sm.Price,2) as Price, ROUND(sm.openPrice,2) as openPrice,ROUND(sm.lowPrice,2) as lowPrice,ROUND(sm.highPrice,2) as highPrice,sm.volume,sm.lastClosingPrice,ROUND(sm.priceChangeDollar,2) as priceChangeDollar, ROUND(sm.priceChangePerc, 2) as priceChangePerc,sm.lastUpdatedDate,ROUND(sm.extendedHoursPrice,2) as extendedHoursPrice,ROUND(sm.extendedHoursChange,2) as extendedHoursChange, ROUND(sm.extendedHoursChangePerc,2) as extendedHoursChangePerc,sm.priceType, CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
            FROM Stock_Master sm \
            LEFT OUTER JOIN Stock h ON sm.ticker = h.ticker and h.category = 'Portfolio' \
            LEFT OUTER JOIN StockChart s ON sm.ticker = s.ticker and s.category = 'Trending' \
            LEFT OUTER JOIN (SELECT ticker, category, sScore,  trendingScore, date FROM StockChart WHERE ticker = '" + ticker + "' and category = 'Trending' and date < (SELECT MAX(date) FROM StockChart) order by date desc limit 1) s2 ON s2.ticker = s.ticker \
            LEFT OUTER JOIN Watchlist w on sm.ticker = w.value AND w.username = '" + userid + "'\
            WHERE sm.isActive != 'N' and sm.ticker = '" + ticker + "' ORDER BY s.date DESC LIMIT 1 ";
    return executeQuery(sql);
}

function getHolding(ticker) {
    sql = "SELECT ticker,DATE_FORMAT(date, '%Y-%m-%d') as date,holding FROM StockChart\
            WHERE category = 'Portfolio' \
            AND ticker = '" + ticker + "' ORDER BY date ASC LIMIT 61";
    return executeQuery(sql);
}

function getSentiment(ticker) {
    sql = "SELECT ticker,DATE_FORMAT(date, '%Y-%m-%d') as date,sScore FROM StockChart\
            WHERE category = 'Trending' \
            AND ticker = '" + ticker + "' ORDER BY date ASC LIMIT 61";
    return executeQuery(sql);
}

function getTrending(ticker) {
    sql = "SELECT ticker,DATE_FORMAT(date, '%Y-%m-%d') as date,trendingScore FROM StockChart\
            WHERE category = 'Trending' \
            AND ticker = '" + ticker + "' ORDER BY date ASC LIMIT 61";
    return executeQuery(sql);
}


function getTweet(ticker) {

    sql = "SELECT c.date,c.tUserName,a.name,a.profilePicMini,c.tweet,CONCAT('https://twitter.com/',c.tUserName,'/status/',c.tweetID) as 'tweetLink'\
            FROM Conversation c \
            INNER JOIN Analyst a on c.tUserID = a.tUserID\
            WHERE c.ticker = '" + ticker + "'\
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

    sql = "SELECT c.tUserName,a.name,a.description,a.profilePicMini, CONCAT('https://twitter.com/',c.tUserName) as 'twitterID', ROUND(SUM(c.count)*100/(Select SUM(cm.count) from Conversation_Master cm where cm.granularity = 'daily' and cm.ticker = '" + ticker + "'),1) as 'Perc'\
           FROM Conversation_Master c \
           INNER JOIN Analyst a on c.tUserID = a.tUserID \
           WHERE a.followerCount > 5000 and c.granularity = 'daily' and c.ticker = '" + ticker + "'\
           GROUP BY c.tUserName \
           ORDER BY Perc desc \
           LIMIT 50";

    return executeQuery(sql);
}


function getInvestors(ticker) {
    sql = "SELECT a.tUserName,a.name,a.description, a.profilePicMini,CONCAT('https://twitter.com/',a.tUserName) as 'twitterID', p.dateAdded from Portfolio_Master p\
            INNER JOIN Analyst a on p.tUserID = a.tUserID \
            WHERE a.followerCount > 5000 AND p.ticker = '" + ticker + "' \
            ORDER BY a.followerCount DESC \
            LIMIT 50";

    return executeQuery(sql);
}




function getTimeSeries(granularity, ticker) {
    sql = "SELECT t.ticker,t.granularity,t.date,ROUND(t.price,2) as price,t.volume FROM Timeseries t\
            INNER JOIN Stock_Master sm on t.ticker = sm.ticker \
            WHERE sm.isActive != 'N' \
            AND t.granularity = '"+ granularity + "' \
            AND t.ticker = '" + ticker + "'";
    return executeQuery(sql);
}

function getStockPositive() {
    sql = " SELECT 'Positive' AS 'category',s.sScore, s.sScoreChange,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.Price,sm.50DMA,sm.200DMA,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio  \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            LEFT OUTER JOIN Watchlist w on s.ticker = w.value AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and s.sScore > 0 and s.coverage >= 1\
            order by s.sScore desc, s.coverage desc  limit 200";
    return executeQuery(sql);
}

function getStockNegative() {
    sql = "SELECT 'Negative' AS 'category',s.sScore, s.sScoreChange,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.Price,sm.50DMA,sm.200DMA,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio  \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            LEFT OUTER JOIN Watchlist w on s.ticker = w.value AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and s.sScore < 0 and s.coverage >= 1\
            order by s.sScore asc,s.coverage desc  limit 200";
    return executeQuery(sql);
}

function getStockHotStocks() {
    sql = "SELECT 'Hot Stocks' AS 'category',ROW_NUMBER() OVER (ORDER BY s.holdingChangePerc DESC,s.coverage DESC ) AS tickerRank, s.holdingChangePerc,sm.ticker,sm.company,sm.sector,sm.marketCap,ROUND(sm.Price,2) as Price,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,CASE WHEN w.category = 'Watchlist'  THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio  \
            FROM Stock s \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker AND s.category = 'Portfolio' \
            LEFT OUTER JOIN Watchlist w on s.ticker = w.value AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and s.holdingChange > 0\
            limit 200";

    return executeQuery(sql);
}


function getStockTopHoldings() {

    sql = "SELECT s.category,ROW_NUMBER() OVER (ORDER BY s.holding DESC ) AS tickerRank, s.holding,sm.ticker,sm.company,sm.sector,sm.marketCap,ROUND(sm.Price,2) as Price,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
            FROM Stock s \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker AND s.category = 'Portfolio' \
            LEFT OUTER JOIN Watchlist w on s.ticker = w.value AND w.username = '" + userid + "'\
            where sm.isActive != 'N'\
            limit 200";


    return executeQuery(sql);
}

function getStockPositiveFree() {
    sql = " SELECT 'Positive' AS 'category',s.sScore, s.sScoreChange,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.Price,sm.50DMA,sm.200DMA,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio  \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            LEFT OUTER JOIN Watchlist w on s.ticker = w.value AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and s.sScore > 0 and s.coverage >= 1\
            order by s.sScore desc, s.coverage desc  limit 5";
    return executeQuery(sql);
}

function getStockNegativeFree() {
    sql = "SELECT 'Negative' AS 'category',s.sScore, s.sScoreChange,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.Price,sm.50DMA,sm.200DMA,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio  \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            LEFT OUTER JOIN Watchlist w on s.ticker = w.value AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and s.sScore < 0 and s.coverage >= 1\
            order by s.sScore asc,s.coverage desc  limit 5";
    return executeQuery(sql);
}

function getStockHotStocksFree() {
    sql = "SELECT 'Hot Stocks' AS 'category',ROW_NUMBER() OVER (ORDER BY s.holdingChangePerc DESC,s.coverage DESC ) AS tickerRank, s.holdingChangePerc,sm.ticker,sm.company,sm.sector,sm.marketCap,ROUND(sm.Price,2) as Price,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,CASE WHEN w.category = 'Watchlist'  THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio  \
            FROM Stock s \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker AND s.category = 'Portfolio' \
            LEFT OUTER JOIN Watchlist w on s.ticker = w.value AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and s.holdingChange > 0\
            limit 5";

    return executeQuery(sql);
}

function getStockTopHoldingsFree() {

    sql = "SELECT s.category,ROW_NUMBER() OVER (ORDER BY s.holding DESC ) AS tickerRank, s.holding,sm.ticker,sm.company,sm.sector,sm.marketCap,ROUND(sm.Price,2) as Price,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
            FROM Stock s \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker AND s.category = 'Portfolio' \
            LEFT OUTER JOIN Watchlist w on s.ticker = w.value AND w.username = '" + userid + "'\
            where sm.isActive != 'N'\
            limit 5";


    return executeQuery(sql);
}


function getWatchlistPositiveFree() {
    sql = " SELECT 'Positive' AS 'category',s.sScore, s.sScoreChange,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.Price,sm.50DMA,sm.200DMA,CASE WHEN w.value IS NULL THEN false ELSE true END AS watchlist,false as portfolio  \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category = 'Watchlist' AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and s.sScore > 0\
            order by s.sScore desc limit 5";
    return executeQuery(sql);
}

function getWatchlistNegativeFree() {
    sql = "SELECT 'Negative' AS 'category', s.sScore, s.sScoreChange,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.Price,sm.50DMA,sm.200DMA,CASE WHEN w.value IS NULL THEN false ELSE true END AS watchlist, false as portfolio  \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category = 'Watchlist' AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and s.sScore < 0\
            order by s.sScore asc,s.coverage desc limit 5";
    return executeQuery(sql);
}

function getWatchlistHotStocksFree() {

    sql = "SELECT 'Hot Stocks' AS 'category',ROW_NUMBER() OVER (ORDER BY s.holdingChangePerc DESC,s.coverage DESC ) AS tickerRank, s.holdingChangePerc,sm.ticker,sm.company,sm.sector,sm.marketCap,ROUND(sm.Price,2) as Price,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,CASE WHEN w.value IS NULL THEN false ELSE true END AS watchlist, false as portfolio \
            FROM Stock s \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker AND s.category = 'Portfolio' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category = 'Watchlist' AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and s.holdingChangePerc > 0\
            limit 5";

    return executeQuery(sql);
}

function getWatchlistTopHoldingsFree() {

    sql = "SELECT s.category,ROW_NUMBER() OVER (ORDER BY s.holding DESC ) AS tickerRank,s.holding,sm.ticker,sm.company,sm.sector,sm.marketCap,ROUND(sm.Price,2) as Price,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,CASE WHEN w.value IS NULL THEN false ELSE true END AS watchlist, false as portfolio  \
            FROM Stock s \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker AND s.category = 'Portfolio' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category = 'Watchlist' AND w.username = '" + userid + "'\
            where sm.isActive != 'N'\
            order by s.holding desc limit 5";

    return executeQuery(sql);
}


function getWatchlistPositive() {
    sql = " SELECT 'Positive' AS 'category',s.sScore, s.sScoreChange,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.Price,sm.50DMA,sm.200DMA,CASE WHEN w.value IS NULL THEN false ELSE true END AS watchlist,false as portfolio  \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category = 'Watchlist' AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and s.sScore > 0\
            order by s.sScore desc limit 200";
    return executeQuery(sql);
}

function getWatchlistNegative() {
    sql = "SELECT 'Negative' AS 'category', s.sScore, s.sScoreChange,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.Price,sm.50DMA,sm.200DMA,CASE WHEN w.value IS NULL THEN false ELSE true END AS watchlist, false as portfolio  \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category = 'Watchlist' AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and s.sScore < 0\
            order by s.sScore asc,s.coverage desc limit 200";
    return executeQuery(sql);
}

function getWatchlistHotStocks() {

    sql = "SELECT 'Hot Stocks' AS 'category',ROW_NUMBER() OVER (ORDER BY s.holdingChangePerc DESC,s.coverage DESC ) AS tickerRank, s.holdingChangePerc,sm.ticker,sm.company,sm.sector,sm.marketCap,ROUND(sm.Price,2) as Price,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,CASE WHEN w.value IS NULL THEN false ELSE true END AS watchlist, false as portfolio \
            FROM Stock s \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker AND s.category = 'Portfolio' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category = 'Watchlist' AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and s.holdingChangePerc > 0\
            limit 200";

    return executeQuery(sql);
}

function getWatchlistTopHoldings() {

    sql = "SELECT s.category,ROW_NUMBER() OVER (ORDER BY s.holding DESC ) AS tickerRank,s.holding,sm.ticker,sm.company,sm.sector,sm.marketCap,ROUND(sm.Price,2) as Price,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,CASE WHEN w.value IS NULL THEN false ELSE true END AS watchlist, false as portfolio  \
            FROM Stock s \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker AND s.category = 'Portfolio' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category = 'Watchlist' AND w.username = '" + userid + "'\
            where sm.isActive != 'N'\
            order by s.holding desc limit 200";

    return executeQuery(sql);
}



function getPortfolioPositiveFree() {
    sql = "SELECT 'Positive' AS 'category',s.sScore, s.sScoreChange,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.Price,sm.50DMA,sm.200DMA,false as watchlist, CASE WHEN w.value IS NULL THEN false ELSE true END AS portfolio \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category = 'Portfolio' AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and s.sScore > 0\
            order by s.sScore desc,s.coverage desc  limit 5";
    return executeQuery(sql);
}

function getPortfolioNegativeFree() {
    sql = "SELECT 'Negative' AS 'category',s.sScore, s.sScoreChange,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.Price,sm.50DMA,sm.200DMA,false as watchlist, CASE WHEN w.value IS NULL THEN false ELSE true END AS portfolio \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category = 'Portfolio' AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and s.sScore < 0\
            order by s.sScore asc,s.coverage desc  limit 5";
    return executeQuery(sql);
}

function getPortfolioHotStocksFree() {
    sql = "SELECT 'Hot Stocks' AS 'category',ROW_NUMBER() OVER (ORDER BY s.holdingChangePerc DESC,s.coverage DESC ) AS tickerRank, s.holdingChangePerc,sm.ticker,sm.company,sm.sector,sm.marketCap,ROUND(sm.Price,2) as Price,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,false as watchlist, CASE WHEN w.value IS NULL THEN false ELSE true END AS portfolio \
            FROM Stock s \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker AND s.category = 'Portfolio' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category = 'Portfolio' AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and s.holdingChangePerc > 0\
            limit 5";

    return executeQuery(sql);
}

function getPortfolioTopHoldingsFree() {

    sql = "SELECT s.category,ROW_NUMBER() OVER (ORDER BY s.holding DESC ) AS tickerRank, s.holding,sm.ticker,sm.company,sm.sector,sm.marketCap,ROUND(sm.Price,2) as Price,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,false as watchlist, CASE WHEN w.value IS NULL THEN false ELSE true END AS portfolio \
            FROM Stock s \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker AND s.category = 'Portfolio' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category = 'Portfolio' AND w.username = '" + userid + "'\
            where sm.isActive != 'N'\
            limit 5";

    return executeQuery(sql);
}


function getPortfolioPositive() {
    sql = "SELECT 'Positive' AS 'category',s.sScore, s.sScoreChange,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.Price,sm.50DMA,sm.200DMA,false as watchlist, CASE WHEN w.value IS NULL THEN false ELSE true END AS portfolio \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category = 'Portfolio' AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and s.sScore > 0\
            order by s.sScore desc,s.coverage desc  limit 200";
    return executeQuery(sql);
}

function getPortfolioNegative() {
    sql = "SELECT 'Negative' AS 'category',s.sScore, s.sScoreChange,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.Price,sm.50DMA,sm.200DMA,false as watchlist, CASE WHEN w.value IS NULL THEN false ELSE true END AS portfolio \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category = 'Portfolio' AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and s.sScore < 0\
            order by s.sScore asc,s.coverage desc  limit 200";
    return executeQuery(sql);
}

function getPortfolioHotStocks() {
    sql = "SELECT 'Hot Stocks' AS 'category',ROW_NUMBER() OVER (ORDER BY s.holdingChangePerc DESC,s.coverage DESC ) AS tickerRank, s.holdingChangePerc,sm.ticker,sm.company,sm.sector,sm.marketCap,ROUND(sm.Price,2) as Price,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,false as watchlist, CASE WHEN w.value IS NULL THEN false ELSE true END AS portfolio \
            FROM Stock s \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker AND s.category = 'Portfolio' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category = 'Portfolio' AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and s.holdingChangePerc > 0\
            limit 200";

    return executeQuery(sql);
}

function getPortfolioTopHoldings() {

    sql = "SELECT s.category,ROW_NUMBER() OVER (ORDER BY s.holding DESC ) AS tickerRank, s.holding,sm.ticker,sm.company,sm.sector,sm.marketCap,ROUND(sm.Price,2) as Price,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,false as watchlist, CASE WHEN w.value IS NULL THEN false ELSE true END AS portfolio \
            FROM Stock s \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker AND s.category = 'Portfolio' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category = 'Portfolio' AND w.username = '" + userid + "'\
            where sm.isActive != 'N'\
            limit 200";

    return executeQuery(sql);
}


function getPWPositiveFree() {
    sql = "SELECT 'Positive' AS 'category', s.sScore, s.sScoreChange,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.Price,sm.50DMA,sm.200DMA,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category in ('Portfolio','Watchlist') AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and s.sScore > 0 \
            order by s.sScore desc, s.coverage desc limit 5" ;

    return executeQuery(sql);
}

function getPWNegativeFree() {
    sql = "SELECT 'Negative' AS 'category',s.sScore, s.sScoreChange,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.Price,sm.50DMA,sm.200DMA,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category in ('Portfolio','Watchlist') AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and s.sScore < 0\
            order by s.sScore asc,s.coverage desc limit 5";
    return executeQuery(sql);
}

function getPWPositive() {
    sql = "SELECT 'Positive' AS 'category', s.sScore, s.sScoreChange,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.Price,sm.50DMA,sm.200DMA,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category in ('Portfolio','Watchlist') AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and s.sScore > 0 \
            order by s.sScore desc, s.coverage desc limit 200" ;

    return executeQuery(sql);
}

function getPWNegative() {
    sql = "SELECT 'Negative' AS 'category',s.sScore, s.sScoreChange,sm.ticker,sm.company,sm.industry,sm.sector,sm.marketCap,sm.Price,sm.50DMA,sm.200DMA,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
            FROM Stock s  \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker and s.category = 'Trending' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category in ('Portfolio','Watchlist') AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and s.sScore < 0\
            order by s.sScore asc,s.coverage desc limit 200";
    return executeQuery(sql);
}


function getPWHotStocksFree() {
    sql = "SELECT 'hotstocks' AS 'category',ROW_NUMBER() OVER (ORDER BY s.holdingChangePerc DESC,s.coverage DESC ) AS tickerRank, s.holdingChangePerc,sm.ticker,sm.company,sm.sector,sm.marketCap,ROUND(sm.Price,2) as Price,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as PRICE,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
            FROM Stock s \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker AND s.category = 'Portfolio' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category in ('Portfolio','Watchlist') AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and s.holdingChangePerc > 0\
            limit 5";

    return executeQuery(sql);
}


function getPWHotStocks() {
    sql = "SELECT 'hotstocks' AS 'category',ROW_NUMBER() OVER (ORDER BY s.holdingChangePerc DESC,s.coverage DESC ) AS tickerRank, s.holdingChangePerc,sm.ticker,sm.company,sm.sector,sm.marketCap,ROUND(sm.Price,2) as Price,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as PRICE,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
            FROM Stock s \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker AND s.category = 'Portfolio' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category in ('Portfolio','Watchlist') AND w.username = '" + userid + "'\
            where sm.isActive != 'N' and s.holdingChangePerc > 0\
            limit 200";

    return executeQuery(sql);
}



function getPWTopHoldingsFree() {

    sql = "SELECT s.category,ROW_NUMBER() OVER (ORDER BY s.holding DESC ) AS tickerRank, s.holding,sm.ticker,sm.company,sm.sector,sm.marketCap,ROUND(sm.Price,2) as Price,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
            FROM Stock s \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker AND s.category = 'Portfolio' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category in ('Portfolio','Watchlist') AND w.username = '" + userid + "'\
            where sm.isActive != 'N'\
            limit 5";

    return executeQuery(sql);
}

function getPWTopHoldings() {

    sql = "SELECT s.category,ROW_NUMBER() OVER (ORDER BY s.holding DESC ) AS tickerRank, s.holding,sm.ticker,sm.company,sm.sector,sm.marketCap,ROUND(sm.Price,2) as Price,ROUND(sm.priceChangeDollar,2) as priceChangeDollar,ROUND(sm.priceChangePerc,2) as priceChangePerc,CASE WHEN w.category = 'Watchlist' THEN true ELSE false END AS watchlist,CASE WHEN w.category = 'Portfolio' THEN true ELSE false END AS portfolio \
            FROM Stock s \
            INNER JOIN Stock_Master sm on s.ticker = sm.ticker AND s.category = 'Portfolio' \
            INNER JOIN Watchlist w on s.ticker = w.value AND w.category in ('Portfolio','Watchlist') AND w.username = '" + userid + "'\
            where sm.isActive != 'N'\
            limit 200";

    return executeQuery(sql);
}