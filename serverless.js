const aws = require('aws-sdk')
const { isEmpty, isNil, mergeDeepRight, pick } = require('ramda')
const { Component } = require('@serverless/core')
const {
  createTopic,
  deleteTopic,
  getDefaults,
  getTopic,
  getAccountId,
  getArn,
  updateAttributes
} = require('./utils')

const outputsList = ['arn']

const defaults = {
  name: 'serverless',
  description: 'AWS SNS Topic Component',
  displayName: '',
  policy: {
    Version: '2008-10-17',
    Id: 'policy_id',
    Statement: [
      {
        Sid: 'statement_id',
        Effect: 'Allow',
        Principal: {
          AWS: '*'
        },
        Action: [
          'SNS:Publish',
          'SNS:RemovePermission',
          'SNS:SetTopicAttributes',
          'SNS:DeleteTopic',
          'SNS:ListSubscriptionsByTopic',
          'SNS:GetTopicAttributes',
          'SNS:Receive',
          'SNS:AddPermission',
          'SNS:Subscribe'
        ],
        Resource: 'TOPIC_ARN',
        Condition: {
          StringEquals: {
            'AWS:SourceOwner': 'ACCOUNT_ID'
          }
        }
      }
    ]
  },
  deliveryPolicy: {
    http: {
      defaultHealthyRetryPolicy: {
        minDelayTarget: 20,
        maxDelayTarget: 20,
        numRetries: 3,
        numMaxDelayRetries: 0,
        numNoDelayRetries: 0,
        numMinDelayRetries: 0,
        backoffFunction: 'linear'
      },
      disableSubscriptionOverrides: false
    }
  },
  deliveryStatusAttributes: [],
  region: 'us-east-1'
}

class AwsSnsTopic extends Component {
  async default(inputs = {}) {
    const accountId = await getAccountId(aws)
    const arn = getArn({
      aws,
      accountId,
      name: inputs.name || defaults.name,
      region: inputs.region || defaults.region
    })

    const populatedDefaults = getDefaults({ accountId, arn, defaults })
    const config = mergeDeepRight(populatedDefaults, inputs)
    for (const i in config.policy.Statement) {
      config.policy.Statement[i] = mergeDeepRight(populatedDefaults.policy.Statement[0], config.policy.Statement[i])
    }
    config.arn = arn

    this.context.status(`Deploying`)

    const sns = new aws.SNS({
      region: config.region,
      credentials: this.context.credentials.aws
    })

    const prevInstance = await getTopic({ sns, arn })

    if (isEmpty(prevInstance)) {
      this.context.status(`Creating`)
      await createTopic({
        sns,
        name: config.name,
        displayName: config.displayName
      })
    } else {
      this.context.status(`Updating`)
    }

    const topicAttributes = await updateAttributes(sns, config, prevInstance)

    this.state.displayName = topicAttributes.DisplayName
    this.state.policy = topicAttributes.Policy
    this.state.deliveryPolicy = topicAttributes.DeliveryPolicy

    this.state.name = config.name
    this.state.arn = config.arn
    await this.save()

    const outputs = pick(outputsList, config)
    return outputs
  }

  async remove(inputs = {}) {

    const config = mergeDeepRight(defaults, inputs)
    config.name = inputs.name || this.state.name || defaults.name

    if (isNil(config.arn)) {
      const accountId = await getAccountId(aws)
      config.arn = getArn({
        aws,
        accountId,
        name: config.name,
        region: config.region
      })
    }

    const sns = new aws.SNS({
      region: config.region,
      credentials: this.context.credentials.aws
    })

    this.context.status(`Removing`)

    await deleteTopic({ sns, arn: config.arn })

    this.state = {}
    await this.save()

    return {}
  }
}

module.exports = AwsSnsTopic
