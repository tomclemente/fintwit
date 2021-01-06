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
        "Access-Control-Allow-Methods": "OPTIONS,POST"
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
                    case 'POST':      
                        getUser().then(async function(data) {
                            if (!isEmpty(data)) {
                                const resp = await insertPayment(data[0].username, params);
                                await sendEmail(generatePaymentConfirmation());
                                resolve(resp);
                            } else {
                                throw new Error("User not found found. Unable to perform POST payment operation");
                            }       
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

function insertPayment(username, params) {
    var post = {
        username: username, 
        confirmationID: params.confirmationID, 
        date: params.date,
        plan: params.plan, 
        amount: params.amount
    };

    sql = "INSERT INTO Payment SET ? ";
    return executePostQuery(sql, post);
}

function getUser() {
    sql = "SELECT * FROM User WHERE username = '" + userid + "'";
    return executeQuery(sql);
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

function getCognitoUser() {
    const cognito = new AWS.CognitoIdentityServiceProvider({ region: process.env.REGION });

    return cognito.adminGetUser({
        UserPoolId: process.env.COGNITO_POOLID,
        Username: userid, 
        
    }).promise();
}

function generatePaymentConfirmation() {
    var param = {
        Destination: {
            ToAddresses: [femail]
        },
        Message: {
            Body: {
                Html: {
                    Charset: "UTF-8",
                    Data: 
                    `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"> 
                    <html xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office" style="width:100%;font-family:arial, 'helvetica neue', helvetica, sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;padding:0;Margin:0">
<head>
    <!--[if gte mso 9]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta name="viewport" content="width=device-width">
    <!--[if !mso]><!-->
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <!--<![endif]-->
    <title></title>
    <!--[if !mso]><!-->
    <link href="https://fonts.googleapis.com/css?family=Open+Sans" rel="stylesheet" type="text/css">
    <link href="https://fonts.googleapis.com/css?family=Nunito" rel="stylesheet" type="text/css">
    <link href="https://fonts.googleapis.com/css?family=Roboto" rel="stylesheet" type="text/css">
    <link href="https://fonts.googleapis.com/css?family=Work+Sans" rel="stylesheet" type="text/css">
    <link href="https://fonts.googleapis.com/css?family=Roboto+Slab" rel="stylesheet" type="text/css">
    <link href="https://fonts.googleapis.com/css?family=Poppins" rel="stylesheet" type="text/css">
    <link href="https:////db.onlinewebfonts.com/c/63137a821976b7fdfcf941ab1528cb19?family=AG_Helvetica" rel="stylesheet" type="text/css">
    <link href="http://db.onlinewebfonts.com/c/37179eaff82fadd96c6be51be8f011d6?family=ITC+Caslon+No.224" rel="stylesheet" type="text/css">
    <!--<![endif]-->
    <style type="text/css">
        body {
            margin: 0;
            padding: 0;
        }

        table,
        td,
        tr {
            vertical-align: top;
            border-collapse: collapse;
        }

        * {
            line-height: inherit;
        }

        a[x-apple-data-detectors=true] {
            color: inherit !important;
            text-decoration: none !important;
        }
    </style>
    <style type="text/css" id="media-query">
        @media (max-width: 620px) {

            .block-grid,
            .col {
                min-width: 320px !important;
                max-width: 100% !important;
                display: block !important;
            }

            .block-grid {
                width: 100% !important;
            }

            .col {
                width: 100% !important;
            }

            .col_cont {
                margin: 0 auto;
            }

            img.fullwidth,
            img.fullwidthOnMobile {
                max-width: 100% !important;
            }

            .no-stack .col {
                min-width: 0 !important;
                display: table-cell !important;
            }

            .no-stack.two-up .col {
                width: 50% !important;
            }

            .no-stack .col.num2 {
                width: 16.6% !important;
            }

            .no-stack .col.num3 {
                width: 25% !important;
            }

            .no-stack .col.num4 {
                width: 33% !important;
            }

            .no-stack .col.num5 {
                width: 41.6% !important;
            }

            .no-stack .col.num6 {
                width: 50% !important;
            }

            .no-stack .col.num7 {
                width: 58.3% !important;
            }

            .no-stack .col.num8 {
                width: 66.6% !important;
            }

            .no-stack .col.num9 {
                width: 75% !important;
            }

            .no-stack .col.num10 {
                width: 83.3% !important;
            }

            .video-block {
                max-width: none !important;
            }

            .mobile_hide {
                min-height: 0px;
                max-height: 0px;
                max-width: 0px;
                display: none;
                overflow: hidden;
                font-size: 0px;
            }

            .desktop_hide {
                display: block !important;
                max-height: none !important;
            }
        }
    </style>
</head>

<body class="clean-body" style="margin: 0; padding: 0; -webkit-text-size-adjust: 100%; background-color: background: #000000;">
    <!--[if IE]><div class="ie-browser"><![endif]-->
    <table class="nl-container" style="table-layout: fixed; vertical-align: top; min-width: 320px; border-spacing: 0; border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #f9f9f9; width: 100%;" cellpadding="0" cellspacing="0" role="presentation" width="100%" bgcolor="#f9f9f9" valign="top">
        <tbody>
            <tr style="vertical-align: top;" valign="top">
                <td style="word-break: break-word; vertical-align: top;" valign="top">
                    <!--[if (mso)|(IE)]><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="background-color:#f9f9f9"><![endif]-->
                    <div style="background-color:transparent;">
                        <div class="block-grid " style="min-width: 320px; max-width: 600px; overflow-wrap: break-word; word-wrap: break-word; word-break: break-word; Margin: 0 auto; background-color: transparent;">
                            <div style="border-collapse: collapse;display: table;width: 100%;background-color:transparent;">
                                <!--[if (mso)|(IE)]><table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:transparent;"><tr><td align="center"><table cellpadding="0" cellspacing="0" border="0" style="width:600px"><tr class="layout-full-width" style="background-color:transparent"><![endif]-->
                                <!--[if (mso)|(IE)]><td align="center" width="600" style="background-color:transparent;width:600px; border-top: 0px solid transparent; border-left: 0px solid transparent; border-bottom: 0px solid transparent; border-right: 0px solid transparent;" valign="top"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-right: 0px; padding-left: 0px; padding-top:5px; padding-bottom:5px;"><![endif]-->
                                <div class="col num12" style="min-width: 320px; max-width: 600px; display: table-cell; vertical-align: top; width: 600px;">
                                    <div class="col_cont" style="width:100% !important;">
                                        <!--[if (!mso)&(!IE)]><!-->
                                        <div style="border-top:0px solid transparent; border-left:0px solid transparent; border-bottom:0px solid transparent; border-right:0px solid transparent; padding-top:5px; padding-bottom:5px; padding-right: 0px; padding-left: 0px;">
                                            <!--<![endif]-->
                                            <table class="divider" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; vertical-align: top; border-spacing: 0; border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; min-width: 100%; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%;" role="presentation" valign="top">
                                                <tbody>
                                                    <tr style="vertical-align: top;" valign="top">
                                                        <td class="divider_inner" style="word-break: break-word; vertical-align: top; min-width: 100%; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; padding-top: 10px; padding-right: 10px; padding-bottom: 10px; padding-left: 10px;" valign="top">
                                                            <table class="divider_content" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; vertical-align: top; border-spacing: 0; border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-top: 0px solid transparent; height: 0px; width: 100%;" align="center" role="presentation" height="0" valign="top">
                                                                <tbody>
                                                                    <tr style="vertical-align: top;" valign="top">
                                                                        <td style="word-break: break-word; vertical-align: top; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%;" height="0" valign="top"><span></span></td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                            <!--[if (!mso)&(!IE)]><!-->
                                        </div>
                                        <!--<![endif]-->
                                    </div>
                                </div>
                                <!--[if (mso)|(IE)]></td></tr></table><![endif]-->
                                <!--[if (mso)|(IE)]></td></tr></table></td></tr></table><![endif] #152238 #001B3A--> 
                            </div>
                        </div>
                    </div>
                    <div style="background-color:transparent;">
                        <div class="block-grid " style="min-width: 320px; max-width: 600px; overflow-wrap: break-word; word-wrap: break-word; word-break: break-word; Margin: 0 auto; background-color: #ffffff;">
                            <div style="border-collapse: collapse;display: table;width: 100%;background-color:#001B3A;">
                                <!--[if (mso)|(IE)]><table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:transparent;"><tr><td align="center"><table cellpadding="0" cellspacing="0" border="0" style="width:600px"><tr class="layout-full-width" style="background-color:#ffffff"><![endif]-->
                                <!--[if (mso)|(IE)]><td align="center" width="600" style="background-color:#ffffff;width:600px; border-top: none; border-left: none; border-bottom: none; border-right: none;" valign="top"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr bgcolor='#F9F9F9'><td colspan='3' style='font-size:7px;line-height:10px'>&nbsp;</td></tr><tr><td style='padding-top:20px;padding-bottom:20px' width='10' bgcolor='#F9F9F9'><table role='presentation' width='10' cellpadding='0' cellspacing='0' border='0'><tr><td>&nbsp;</td></tr></table></td><td style="padding-right: 25px; padding-left: 25px; padding-top:20px; padding-bottom:20px;"><![endif]-->
                                <div class="col num12" style="min-width: 320px; max-width: 600px; display: table-cell; vertical-align: top; width: 580px;">
                                    <div class="col_cont" style="width:100% !important;">
                                        <!--[if (!mso)&(!IE)]><!-->
                                        <div style="border-top:10px solid #F9F9F9; border-left:10px solid #F9F9F9; border-bottom:10px solid #F9F9F9; border-right:10px solid #F9F9F9; padding-top:20px; padding-bottom:20px; padding-right: 25px; padding-left: 25px;">
                                            <!--<![endif]-->
                                            <div class="img-container center fixedwidth" align="center" style="padding-right: 10px;padding-left: 10px;">

                                                <!--[if mso]><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr style="line-height:0px"><td style="padding-right: 10px;padding-left: 10px;" align="center"><![endif]-->
                                                <div style="font-size:1px;line-height:10px">&nbsp;</div><img class="center fixedwidth" align="center" border="0" src="https://fintwit-resources.s3.amazonaws.com/fintwit_email_logo.png" alt="Alternate text" title="Alternate text" style="text-decoration: none; -ms-interpolation-mode: bicubic; height: auto; border: 0; width: 100%; max-width: 185px; display: block;" width="185">
                                                <div style="font-size:1px;line-height:10px">&nbsp;</div>
                                                <!--[if mso]></td></tr></table><![endif]-->
                                            </div>
                                            <p style="line-height: 1.5; font-family: Helvetica; word-break: break-word; mso-line-height-alt: 18px; margin: 0;">&nbsp;</p>

                                            <!--[if mso]><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-right: 10px; padding-left: 10px; padding-top: 10px; padding-bottom: 10px; font-family: Arial, sans-serif"><![endif]-->
                                            <div style="color:#FFFFFF;font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;line-height:1.5;padding-top:10px;padding-right:10px;padding-bottom:10px;padding-left:10px;">
                                                <div style="line-height: 1.5; font-size: 12px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #FFFFFF; mso-line-height-alt: 18px;">
                                                    <p style="line-height: 1.5; word-break: break-word; text-align: center; font-family: Helvetica; font-size: 24px; mso-line-height-alt: 36px; margin: 0;"><span style="font-size: 20px;">Thanks for signing up!</span></p>
                                                </div>
                                            </div>
                                            
                                            <!--[if mso]><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-right: 10px; padding-left: 10px; padding-top: 10px; padding-bottom: 10px; font-family: Arial, sans-serif"><![endif]-->
                                            <div style="color:#FFFFFF;font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;line-height:1.5;padding-top:10px;padding-right:10px;padding-bottom:10px;padding-left:10px;">
                                                <div style="line-height: 1.5; font-size: 12px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #FFFFFF; mso-line-height-alt: 18px;">
                                                    <p style="line-height: 1.5; word-break: break-word; text-align: center; font-family: Helvetica; font-size: 15px; mso-line-height-alt: 23px; margin: 0;"><span style="font-size: 14px;">We use advanced Artificial Intelligence algorithms to process hundreds of thousands of tweets from Fintwit community and the surface the most relevant and trending securies in real time.</span></p>
                                                </div>
                                            </div>
                                            <!--[if mso]></td></tr></table><![endif]-->
                                            <div class="button-container" align="center" style="padding-top:15px;padding-right:10px;padding-bottom:15px;padding-left:10px;">
                                                <!--[if mso]><table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-spacing: 0; border-collapse: collapse; mso-table-lspace:0pt; mso-table-rspace:0pt;"><tr><td style="padding-top: 15px; padding-right: 10px; padding-bottom: 15px; padding-left: 10px" align="center"><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="#" style="height:31.5pt; width:204.75pt; v-text-anchor:middle;" arcsize="10%" stroke="false" fillcolor="#f29d38"><w:anchorlock/><v:textbox inset="0,0,0,0"><center style="color:#ffffff; font-family:Arial, sans-serif; font-size:16px"><![endif]--><a href="https://www.fintwit.ai" target="_blank" style="-webkit-text-size-adjust: none; text-decoration: none; display: inline-block; color: #000000; background-color: #1FEE8B; border-radius: 4px; -webkit-border-radius: 4px; -moz-border-radius: 4px; width: auto; width: auto; border-top: 1px solid #1FEE8B; border-right: 1px solid #1FEE8B; border-bottom: 1px solid #1FEE8B; border-left: 1px solid #1FEE8B; padding-top: 5px; padding-bottom: 5px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; text-align: center; mso-border-alt: none; word-break: keep-all;"><span style="padding-left:30px;padding-right:30px;font-size:16px;display:inline-block;"><span style="font-size: 16px; line-height: 2; word-break: break-word; font-family: Helvetica; mso-line-height-alt: 24px;">Go to Fintwit</span></span></a>
                                                <!--[if mso]></center></v:textbox></v:roundrect></td></tr></table><![endif]-->
                                            </div>
                                            <p style="line-height: 1.5; font-family: Helvetica; word-break: break-word; mso-line-height-alt: 18px; margin: 0;">&nbsp;</p>
                                            <p style="line-height: 1.5; font-family: Helvetica; word-break: break-word; mso-line-height-alt: 18px; margin: 0;">&nbsp;</p>
                                            <!--[if mso]><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-right: 10px; padding-left: 10px; padding-top: 10px; padding-bottom: 10px; font-family: Arial, sans-serif"><![endif]-->
                                            <div style="color:#525252;font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;line-height:1.5;padding-top:10px;padding-right:10px;padding-bottom:10px;padding-left:10px;">
                                                <div style="line-height: 1.5; font-size: 12px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #FFFFFF; mso-line-height-alt: 15px;">
                                                    <p style="line-height: 1.5; word-break: break-word; text-align: center; font-family: Helvetica; font-size: 14px; mso-line-height-alt: 20px; margin: 0;"><span style="font-size: 12px;"><span style>If you have any questions, please let us know at support@fintwit.ai</span></span></p>
                                                </div>
                                            </div>
                                            <!--[if mso]></td></tr></table><![endif]-->
                                            <!--[if (!mso)&(!IE)]><!-->
                                        </div>
                                        <!--<![endif]-->
                                    </div>
                                </div>
                                <!--[if (mso)|(IE)]></td><td style='padding-top:20px;padding-bottom:20px' width='10' bgcolor='#F9F9F9'><table role='presentation' width='10' cellpadding='0' cellspacing='0' border='0'><tr><td>&nbsp;</td></tr></table></td></tr><tr bgcolor='#F9F9F9'><td colspan='3' style='font-size:7px;line-height:10px'>&nbsp;</td></tr></table><![endif]-->
                                <!--[if (mso)|(IE)]></td></tr></table></td></tr></table><![endif]-->
                            </div>
                        </div>
                    </div>
                    <div style="background-color:transparent;">
                        <div class="block-grid " style="min-width: 320px; max-width: 600px; overflow-wrap: break-word; word-wrap: break-word; word-break: break-word; Margin: 0 auto; background-color: transparent;">
                            <div style="border-collapse: collapse;display: table;width: 100%;background-color:transparent;">
                                <!--[if (mso)|(IE)]><table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:transparent;"><tr><td align="center"><table cellpadding="0" cellspacing="0" border="0" style="width:600px"><tr class="layout-full-width" style="background-color:transparent"><![endif]-->
                                <!--[if (mso)|(IE)]><td align="center" width="600" style="background-color:transparent;width:600px; border-top: 0px solid transparent; border-left: 0px solid transparent; border-bottom: 0px solid transparent; border-right: 0px solid transparent;" valign="top"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-right: 25px; padding-left: 25px; padding-top:0px; padding-bottom:30px;"><![endif]-->
                                <div class="col num12" style="min-width: 320px; max-width: 600px; display: table-cell; vertical-align: top; width: 600px;">
                                    <div class="col_cont" style="width:100% !important;">
                                        <!--[if (!mso)&(!IE)]><!-->
                                        <div style="border-top:0px solid transparent; border-left:0px solid transparent; border-bottom:0px solid transparent; border-right:0px solid transparent; padding-top:0px; padding-bottom:30px; padding-right: 25px; padding-left: 25px;">
                                            <!--<![endif]-->
                                            <table class="social_icons" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="table-layout: fixed; vertical-align: top; border-spacing: 0; border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;" valign="top">
                                                <tbody>
                                                    <tr style="vertical-align: top;" valign="top">
                                                        <td style="word-break: break-word; vertical-align: top; padding-top: 10px; padding-right: 20px; padding-bottom: 10px; padding-left: 20px;" valign="top">
                                                            <table class="social_table" align="center" cellpadding="0" cellspacing="0" role="presentation" style="table-layout: fixed; vertical-align: top; border-spacing: 0; border-collapse: collapse; mso-table-tspace: 0; mso-table-rspace: 0; mso-table-bspace: 0; mso-table-lspace: 0;" valign="top">
                                                                <tbody>
                                                                    <tr style="vertical-align: top; display: inline-block; text-align: left;" align="left" valign="top">
                                                                        <td style="word-break: break-word; vertical-align: top; padding-bottom: 0; padding-right: 14px; padding-left: 0px;" valign="top"><a href="https://twitter.com/fintwitai" target="_blank"><img width="32" height="32" src="https://d2fi4ri5dhpqd1.cloudfront.net/public/resources/social-networks-icon-sets/circle-dark-gray/twitter@2x.png" alt="Twitter" title="twitter" style="text-decoration: none; -ms-interpolation-mode: bicubic; height: auto; border: 0; display: block;"></a></td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                            <!--[if mso]><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-right: 10px; padding-left: 10px; padding-top: 10px; padding-bottom: 0px; font-family: Arial, sans-serif"><![endif]-->
                                            <div style="color:#aaaaaa;font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;line-height:1.2;padding-top:10px;padding-right:10px;padding-bottom:0px;padding-left:10px;">
                                                <div style="line-height: 1.2; font-size: 12px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #aaaaaa; mso-line-height-alt: 14px;">
                                                    <p style="font-size: 12px; line-height: 1.2; word-break: break-word; text-align: center; font-family: Helvetica; mso-line-height-alt: 14px; margin: 0;"><span style="font-size: 12px;">2020 © Fintwit, All Rights Reserved</span></p>
                                                </div>
                                            </div>
                                            <!--[if mso]></td></tr></table><![endif]-->
                                            <!--[if (!mso)&(!IE)]><!-->
                                        </div>
                                        <!--<![endif]-->
                                    </div>
                                </div>
                                <!--[if (mso)|(IE)]></td></tr></table><![endif]-->
                                <!--[if (mso)|(IE)]></td></tr></table></td></tr></table><![endif]-->
                            </div>
                        </div>
                    </div>
                    <!--[if (mso)|(IE)]></td></tr></table><![endif]-->
                </td>
            </tr>
        </tbody>
    </table>
    <!--[if (IE)]></div><![endif]-->
</body>
</html>`
                }
            },
            Subject: { Data: "Payment confirmation!" }
        },
        Source: sourceEmail
    };

    return param;
}