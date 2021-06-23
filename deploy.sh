#!/bin/sh
LAMBDA_VERSION="7"
export AWS_PROFILE=ratingsuite
cd fw-admin-api && rm .deploy* ; touch .deploy_$LAMBDA_VERSION && sudo sam build && sam deploy
cd ../fw-analyst-api && rm .deploy* ; touch .deploy_$LAMBDA_VERSION && sudo sam build && sam deploy
cd ../fw-payment-api && rm .deploy* ; touch .deploy_$LAMBDA_VERSION && sudo sam build && sam deploy
cd ../fw-stock-api && rm .deploy* ; touch .deploy_$LAMBDA_VERSION && sudo sam build && sam deploy
cd ../fw-user-api && rm .deploy* ; touch .deploy_$LAMBDA_VERSION && sudo sam build && sam deploy
cd ../fw-watchlist-api && rm .deploy* ; touch .deploy_$LAMBDA_VERSION && sudo sam build && sam deploy
aws lambda publish-version --function-name fw-admin-api
aws lambda publish-version --function-name fw-analyst-api
aws lambda publish-version --function-name fw-payment-api
aws lambda publish-version --function-name fw-stock-api
aws lambda publish-version --function-name fw-user-api
aws lambda publish-version --function-name fw-watchlist-api
aws lambda add-permission   --function-name "arn:aws:lambda:us-east-1:996427988132:function:fw-admin-api:$LAMBDA_VERSION"   --source-arn  "arn:aws:execute-api:us-east-1:996427988132:tikuehv7id/*" --region us-east-1  --principal apigateway.amazonaws.com   --statement-id lambda_version_up   --action lambda:InvokeFunction
aws lambda add-permission   --function-name "arn:aws:lambda:us-east-1:996427988132:function:fw-analyst-api:$LAMBDA_VERSION"   --source-arn  "arn:aws:execute-api:us-east-1:996427988132:tikuehv7id/*" --region us-east-1  --principal apigateway.amazonaws.com   --statement-id lambda_version_up   --action lambda:InvokeFunction
aws lambda add-permission   --function-name "arn:aws:lambda:us-east-1:996427988132:function:fw-payment-api:$LAMBDA_VERSION"   --source-arn  "arn:aws:execute-api:us-east-1:996427988132:tikuehv7id/*" --region us-east-1  --principal apigateway.amazonaws.com   --statement-id lambda_version_up   --action lambda:InvokeFunction
aws lambda add-permission   --function-name "arn:aws:lambda:us-east-1:996427988132:function:fw-stock-api:$LAMBDA_VERSION"   --source-arn  "arn:aws:execute-api:us-east-1:996427988132:tikuehv7id/*" --region us-east-1  --principal apigateway.amazonaws.com   --statement-id lambda_version_up   --action lambda:InvokeFunction
aws lambda add-permission   --function-name "arn:aws:lambda:us-east-1:996427988132:function:fw-user-api:$LAMBDA_VERSION"   --source-arn  "arn:aws:execute-api:us-east-1:996427988132:tikuehv7id/*" --region us-east-1  --principal apigateway.amazonaws.com   --statement-id lambda_version_up   --action lambda:InvokeFunction
aws lambda add-permission   --function-name "arn:aws:lambda:us-east-1:996427988132:function:fw-watchlist-api:$LAMBDA_VERSION"   --source-arn  "arn:aws:execute-api:us-east-1:996427988132:tikuehv7id/*" --region us-east-1  --principal apigateway.amazonaws.com   --statement-id lambda_version_up   --action lambda:InvokeFunction