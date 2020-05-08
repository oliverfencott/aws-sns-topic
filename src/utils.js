const {
  clone,
  concat,
  difference,
  fromPairs,
  head,
  is,
  isNil,
  map,
  merge,
  mergeDeepRight,
  pick,
  reduce,
  tail,
  toPairs,
  toUpper
} = require('ramda')

const titelize = (string) => `${toUpper(head(string))}${tail(string)}`
const log = (arg) => (console.log(arg), arg)

const getDefaults = ({ defaults, accountId, arn }) => {
  const response = clone(defaults)
  response.policy.Statement[0].Resource = arn
  response.policy.Statement[0].Condition.StringEquals['AWS:SourceOwner'] = accountId
  return response
}

const getTopic = async ({ sns, arn }) => {
  let topicAttributes = {}
  try {
    const response = await sns.getTopicAttributes({ TopicArn: arn }).promise()
    topicAttributes = response.Attributes
  } catch (error) {
    if (error.code !== 'NotFound') {
      throw error
    }
  }
  return topicAttributes
}

const getAccountId = async (aws) => {
  const STS = new aws.STS()
  const res = await STS.getCallerIdentity({}).promise()
  return res.Account
}

const getArn = ({ name, region, accountId }) => {
  return `arn:aws:sns:${region}:${accountId}:${name}`
}

const resolveInSequence = async (functionsToExecute) =>
  reduce(
    (promise, functionToExecute) =>
      promise.then((result) => functionToExecute().then(Array.prototype.concat.bind(result))),
    Promise.resolve([]),
    functionsToExecute
  )

const updateTopicAttributes = async (sns, { topicAttributes, arn }) =>
  Promise.all(
    map(([key, value]) => {
      const params = {
        TopicArn: arn,
        AttributeName: key,
        AttributeValue: !is(String, value) ? JSON.stringify(value) : value
      }
      return sns.setTopicAttributes(params).promise()
    }, topicAttributes)
  )

const updateDeliveryStatusAttributes = async (sns, { deliveryStatusAttributes, arn }) =>
  // run update requests sequentially because setTopicAttributes
  // fails to update when rate exceeds https://github.com/serverless/components/issues/174#issuecomment-390463523
  resolveInSequence(
    map(
      ([key, value]) => () => {
        const params = {
          TopicArn: arn,
          AttributeName: titelize(key),
          AttributeValue: !is(String, value) ? JSON.stringify(value) : value
        }
        return sns.setTopicAttributes(params).promise()
      },
      deliveryStatusAttributes
    )
  )

const updateAttributes = async (
  sns,
  { displayName, policy, deliveryPolicy, deliveryStatusAttributes = [], arn },
  prevInstance
) => {
  const previousTopicAttributes = map(
    ([key, value]) => [key, /Policy/.test(key) ? JSON.parse(value) : value],
    toPairs(pick(['DisplayName', 'Policy', 'DeliveryPolicy'], prevInstance))
  )

  const currentTopicAttributes = map(
    ([key, value]) => [titelize(key), value],
    toPairs({ displayName, policy, deliveryPolicy })
  )

  const changedTopicAttributes = difference(currentTopicAttributes, previousTopicAttributes)

  const mergedTopicAttributes = mergeDeepRight(
    fromPairs(previousTopicAttributes),
    fromPairs(currentTopicAttributes)
  )

  await updateTopicAttributes(sns, { topicAttributes: changedTopicAttributes, arn })

  const currentDeliveryStatusAttributes = map(
    ([key, value]) => [key, value.toString()],
    reduce((acc, attribute) => concat(acc, toPairs(attribute)), [], deliveryStatusAttributes)
  )

  const previousDeliveryStatusAttributes = toPairs(
    pick(
      [
        'ApplicationSuccessFeedbackRoleArn',
        'ApplicationSuccessFeedbackSampleRate',
        'ApplicationFailureFeedbackRoleArn',
        'HTTPSuccessFeedbackRoleArn',
        'HTTPSuccessFeedbackSampleRate',
        'HTTPFailureFeedbackRoleArn',
        'LambdaSuccessFeedbackRoleArn',
        'LambdaSuccessFeedbackSampleRate',
        'LambdaFailureFeedbackRoleArn',
        'SQSSuccessFeedbackRoleArn',
        'SQSSuccessFeedbackSampleRate',
        'SQSFailureFeedbackRoleArn'
      ],
      prevInstance
    )
  )

  const removableDeliveryStatusAttributes = map(([key, value]) => {
    return [
      key,
      isNil(currentDeliveryStatusAttributes[key]) && !/SampleRate/.test(key) ? '' : value
    ]
  }, difference(previousDeliveryStatusAttributes, currentDeliveryStatusAttributes))

  const changedDeliveryStatusAttributes = concat(
    difference(currentDeliveryStatusAttributes, previousDeliveryStatusAttributes),
    removableDeliveryStatusAttributes
  )

  await updateDeliveryStatusAttributes(sns, {
    deliveryStatusAttributes: changedDeliveryStatusAttributes,
    arn
  })

  return merge(mergedTopicAttributes, currentDeliveryStatusAttributes)
}

const createTopic = async ({ sns, name }) => {
  const { TopicArn: arn } = await sns.createTopic({ Name: name }).promise()
  return { arn }
}

const deleteTopic = async ({ sns, arn }) => {
  try {
    await sns.deleteTopic({ TopicArn: arn }).promise()
  } catch (error) {
    if (error.code !== 'NotFound') {
      throw error
    }
  }
}

module.exports = {
  createTopic,
  deleteTopic,
  getAccountId,
  getArn,
  getDefaults,
  getTopic,
  updateAttributes,
  log
}
