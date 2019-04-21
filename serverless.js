const aws = require('aws-sdk')
const { isEmpty, mergeDeepRight, pick } = require('ramda')
const { Component } = require('@serverless/components')
const { createTopic, deleteTopic, getTopic, resolveArn } = require('./utils')

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

    const arn = await resolveArn({ aws, name: config.name, region: config.region })

    const prevInstance = await getTopic({ sns, arn })

    if (isEmpty(prevInstance)) {
      this.cli.status(`Creating`)
      const result = await createTopic({ sns, name: config.name })
    } else {
      this.cli.status(`Updating`)
      // update attributes
    }

    config.arn = arn

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

    const arn = await resolveArn({ aws, name: config.name, region: config.region })

    const sns = new aws.SNS({
      region: config.region,
      credentials: this.context.credentials.aws
    })

    this.cli.status(`Removing`)

    await deleteTopic({ sns, arn })

    this.state = {}
    await this.save()

    return {}
  }
}

module.exports = AwsSnsTopic
