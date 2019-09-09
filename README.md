# AWS SNS Topic

Deploy SNS Topic to AWS in seconds with [Serverless Components](https://github.com/serverless/components).

&nbsp;

1. [Install](#1-install)
2. [Create](#2-create)
3. [Configure](#3-configure)
4. [Deploy](#4-deploy)

&nbsp;


### 1. Install

```console
$ npm install -g serverless
```

### 2. Create

Just create a `serverless.yml` file

```shell
$ touch serverless.yml
$ touch .env      # your development AWS api keys
$ touch .env.prod # your production AWS api keys
```

the `.env` files are not required if you have the aws keys set globally and you want to use a single stage, but they should look like this.

```
AWS_ACCESS_KEY_ID=XXX
AWS_SECRET_ACCESS_KEY=XXX
```

### 3. Configure

```yml
# serverless.yml

name: my-topic
stage: dev

myTopic:
  component: '@serverless/aws-sns-topic'
  inputs:
    name: my-topic
    # optional display name
    displayName: my-topic-display
    # optional access policy
    policy:
      Version: '2008-10-17'
      Id: policy_id
      Statement:
        - Effect: Allow
          Sid: statement_id
          Principal:
            AWS: '*'
          Action:
            - SNS:Publish
            - SNS:RemovePermission
            - SNS:SetTopicAttributes
            - SNS:DeleteTopic
            - SNS:ListSubscriptionsByTopic
            - SNS:GetTopicAttributes
            - SNS:Receive
            - SNS:AddPermission
            - SNS:Subscribe
          Resource: arn:aws:sns:us-east-1:123456789012:my-topic
          Condition:
            StringEquals:
              AWS:SourceOwner: '123456789012'
    # optional delivery policy
    deliveryPolicy:
      http:
        defaultHealthyRetryPolicy:
          minDelayTarget: 20
          maxDelayTarget: 20
          numRetries: 3
          numMaxDelayRetries: 0
          numNoDelayRetries: 0
          numMinDelayRetries: 2
          backoffFunction: linear
        disableSubscriptionOverrides: true
        defaultThrottlePolicy:
          maxReceivesPerSecond: 3
    # optional delivery status logging configuration
    deliveryStatusAttributes:
      - ApplicationSuccessFeedbackRoleArn: arn:aws:iam::123456789012:role/SNSSuccessFeedback
        ApplicationSuccessFeedbackSampleRate: 50
        ApplicationFailureFeedbackRoleArn: arn:aws:iam::123456789012:role/SNSFailureFeedback
      - HTTPSuccessFeedbackRoleArn: arn:aws:iam::123456789012:role/SNSSuccessFeedback
        HTTPSuccessFeedbackSampleRate: 50
        HTTPFailureFeedbackRoleArn: arn:aws:iam::123456789012:role/SNSFailureFeedback
      - LambdaSuccessFeedbackRoleArn: arn:aws:iam::123456789012:role/SNSSuccessFeedback
        LambdaSuccessFeedbackSampleRate: 50
        LambdaFailureFeedbackRoleArn: arn:aws:iam::123456789012:role/SNSSuccessFeedback
      - SQSSuccessFeedbackRoleArn: arn:aws:iam::123456789012:role/SNSSuccessFeedback
        SQSSuccessFeedbackSampleRate: 50
        SQSFailureFeedbackRoleArn: arn:aws:iam::123456789012:role/SNSSuccessFeedback
```

### 4. Deploy

```console
$ serverless
```

### New to Components?

Checkout the [Serverless Components](https://github.com/serverless/components) repo for more information.
