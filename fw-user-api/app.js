var mysql = require('mysql');
var AWS = require('aws-sdk');

var sourceEmail = process.env.SOURCE_EMAIL;

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
var respObj = [];
var preferenceType = null;

//cognito information
var fname;
var femail;

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
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE"
    };

    try {

        body = await new Promise((resolve, reject) => {

            getCognitoUser().then(function(data) {              
                console.log("Cognito UserAttributes: ", data.UserAttributes);
                for (var x = 0; x < data.UserAttributes.length; x++) {
                    let attrib = data.UserAttributes[x];

                    if (attrib.Name == 'name') {
                        fname = attrib.Value;
                    } else if (attrib.Name == 'email') {
                        femail = attrib.Value;
                    } 
                }

            }).then(function() {
                switch (event.httpMethod) {

                    case 'GET':
                        getUser().then(function(data) {
                            resolve(data);
                        }, reject);

                    break;

                    case 'POST':      
                        getUser().then(function(data) {
                            if (isEmpty(data)) {
                                return insertUser(userid,fname,femail).then(async function(resp) {                                    
                                    await sendEmail(generateThankYouEmail()).then(resolve(resp), reject);
                                }, reject);
                                
                            } else {
                                throw new Error("Existing user found. Unable to perform POST operation");
                            }       

                        }).catch(err => {
                            reject({ statusCode: 500, body: err.message });
                        }); 

                    break;

                    case 'PUT':
                        getUser().then(async function(data) {
                            if (!isEmpty(data)) {
                                let username = data[0].username;

                                if (!isEmpty(params.subscription) && params.subscription == "CANCELLED") {
                                    await deactivateSubscription(username);
                                    await sendEmail(generateDeactivateEmail());
                                }
                                
                                if (!isEmpty(params.plan)) {
                                    await updateSubscriptionPlan(username, params);
                                    await sendEmail(generatePlanChangeEmail());
                                }
        
                                if (!isEmpty(params.notificationFlag)) {
                                    await updateSubscriptionNotification(username, params);
                                }
                            } else {
                                throw new Error("User is non existent. Unable to perform PUT operation");
                            }                              

                        }, reject).then(function() {
                            resolve(params);
                        }).catch(err => {
                            reject({ statusCode: 500, body: err.message });
                        }); 
       

                    break;
                        
                    case 'DELETE':
                        var resp = [];

                        getUser().then(async function(data) {                         
                            if (!isEmpty(data)) {
                                resp = deleteUser(data[0].username);                            
                                //await deleteCognitoUser();
                                await sendEmail(generateGoodbyeEmail());

                            } else {
                                throw new Error("User is non existent. Unable to perform DELETE operation");
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
            }, reject);
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

function getCognitoUser() {
    const cognito = new AWS.CognitoIdentityServiceProvider({ region: process.env.REGION });

    return cognito.adminGetUser({
        UserPoolId: process.env.COGNITO_POOLID,
        Username: userid, 
        
    }).promise();
}

function sendEmail(params) {
    return new Promise((resolve, reject) => {
        var ses = new AWS.SES({region: 'us-east-1'});
        console.log("Sending Email: ", params);
        ses.sendEmail(params, function (err, data) {
            if (err) {
                console.log("Email Error: ", err);
                reject(err);
            } else {
                console.log("Email Success: ", data);
                resolve(data);
            }
        });
    });
};

function getUser() {
    sql = "SELECT * FROM User WHERE username = '" + userid + "'";
    return executeQuery(sql);
}

function insertUser(username, name, email) {
    var post = {
                username: username, 
                name: name, 
                email: email, 
                notificationFlag: "Y", 
                userType: "USER"
            };

    sql = "INSERT INTO User SET ?";
    return executePostQuery(sql, post);   
}

function generateThankYouEmail() {
    var param = {
        Destination: {
            ToAddresses: [userid]
        },
        Message: {
            Body: {
                Text: {
                    Data: "Thank you for signing up!"
                }
            },
            Subject: { Data: "Welcome to Fintwit!" }
        },
        Source: sourceEmail
    };

    return param;
}

function generateDeactivateEmail() {
    var param = {
        Destination: {
            ToAddresses: [userid]
        },
        Message: {
            Body: {
                Text: {
                    Data: "You have been successfully deactivate from Fintwit!"
                }
            },
            Subject: { Data: "Deactivation Email!" }
        },
        Source: sourceEmail
    };

    return param;
}

function generatePlanChangeEmail() {
    var param = {
        Destination: {
            ToAddresses: [userid]
        },
        Message: {
            Body: {
                Text: {
                    Data: "Your plan has been updated!" 
                }
            },
            Subject: { Data: "Fintwit Plan Change!" }
        },
        Source: sourceEmail
    };

    return param;
}

function generateGoodbyeEmail() {
    var param = {
        Destination: {
            ToAddresses: [userid]
        },
        Message: {
            Body: {
                Text: {
                    Data: "Goodbye!" 
                }
            },
            Subject: { Data: "Farewell from Fintwit!" }
        },
        Source: sourceEmail
    };

    return param;
}

function deactivateSubscription(username) {
    sql = "UPDATE User SET cancelledOn = CURRENT_TIMESTAMP() \
            WHERE username = '" + username + "' ";

    return executeQuery(sql);
}

function updateSubscriptionPlan(username, params) {
    sql = "UPDATE User SET plan = '" + params.plan + "' \
            WHERE username = '" + username + "' ";

    return executeQuery(sql);   
}

function updateSubscriptionNotification(username, params) {
    sql = "UPDATE User SET notificationFlag = '" + params.notificationFlag + "' \
            WHERE username = '" + username + "' ";

    return executeQuery(sql);        
}

function deleteUser(username) {
    sql = "DELETE FROM User WHERE username = '" + username + "' ";
    return executeQuery(sql);
}

function deleteCognitoUser() {
    const cognito = new AWS.CognitoIdentityServiceProvider({ region: process.env.REGION });
    return cognito.adminDeleteUser({
        UserPoolId: process.env.COGNITO_POOLID,
        Username: userid,
    }).promise();
}