const aws = require('aws-sdk')
const { mergeDeepRight, pick } = require('ramda')
const { Component } = require('@serverless/components')
const { createTopic, removeTopic } = require('./utils')

const outputsList = ['arn']

const defaults = {
  name: 'serverless',
  description: 'AWS SNS Topic Component',
  displayNam: undefined,
  policy: {},
  deliveryPolicy: {},
  deliveryStatusAttributes: [],
  region: 'us-east-1'
}

class AwsSnsTopic extends Component {
  async default(inputs = {}) {
    const config = mergeDeepRight(defaults, inputs)

    this.cli.status(`Deploying`)

    const sns = new aws.SNS({
      region: config.region,
      credentials: this.context.credentials.aws
    })

    config.arn = await createTopic({ sns, name: config.name })

    this.state.name = config.name
    this.state.arn = config.arn
    await this.save()

    const outputs = pick(outputsList, config)
    this.cli.outputs(outputs)
    return outputs
  }

  async remove(inputs = {}) {
    const config = mergeDeepRight(defaults, inputs)
    config.name = inputs.name || this.state.name || defaults.name
    const sns = new aws.SNS({
      region: config.region,
      credentials: this.context.credentials.aws
    })

    await removeTopic({ sns, arn: this.state.arn })

    this.state = {}
    await this.save()

    return {}
  }
}

module.exports = AwsSnsTopic
