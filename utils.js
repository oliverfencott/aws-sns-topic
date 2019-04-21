const {
  concat,
  contains,
  equals,
  filter,
  find,
  head,
  isNil,
  keys,
  map,
  merge,
  reduce,
  values
} = require('ramda')

const { titelize } = require('@serverless/components')

const getTopic = async ({ sns, arn }) => {
  let topicAttributes = {};
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

const resolveArn = async ({ aws, name, region }) => {
  const accountId = await getAccountId(aws)
  return `arn:aws:sns:${region}:${accountId}:${name}`
}

const getChangedAttributes = (inputs, state = []) => {
  const attributeKeys = map((item) => head(keys(item)), inputs)
  return filter((item) => isNil(find(equals(item))(state)))(
    concat(
      inputs,
      reduce(
        (attributes, attribute) => {
          const key = head(keys(attribute))
          if (!contains(key, attributeKeys)) {
            // return empty string to "unset" removed value
            return concat(attributes, [{ [key]: '' }])
          }
          return attributes
        },
        [],
        state
      )
    )
  )
}

const resolveInSequence = async (functionsToExecute) =>
  reduce(
    (promise, functionToExecute) =>
      promise.then((result) => functionToExecute().then(Array.prototype.concat.bind(result))),
    Promise.resolve([]),
    functionsToExecute
  )

const updateTopicAttributes = async (sns, { topicAttributes, topicArn }) =>
  Promise.all(
    map((topicAttribute) => {
      const value = head(values(topicAttribute))
      const params = {
        TopicArn: topicArn,
        AttributeName: titelize(head(keys(topicAttribute))),
        AttributeValue: typeof value !== 'string' ? JSON.stringify(value) : value
      }
      return sns.setTopicAttributes(params).promise()
    }, topicAttributes)
  )

const updateDeliveryStatusAttributes = async (sns, { deliveryStatusAttributes, topicArn }) =>
  // run update requests sequentially because setTopicAttributes
  // fails to update when rate exceeds https://github.com/serverless/components/issues/174#issuecomment-390463523
  resolveInSequence(
    map(
      (topicAttribute) => () => {
        const value = head(values(topicAttribute))
        const params = {
          TopicArn: topicArn,
          AttributeName: titelize(head(keys(topicAttribute))),
          AttributeValue: typeof value !== 'string' ? JSON.stringify(value) : value
        }
        return sns.setTopicAttributes(params).promise()
      },
      deliveryStatusAttributes
    )
  )

const updateAttributes = async (
  sns,
  { displayName, policy, deliveryPolicy, deliveryStatusAttributes = [], topicArn },
  prevInstance
) => {
  const topicAttributes = reduce(
    (result, value) => {
      if (head(values(value))) {
        return concat(result, [value])
      }
      return result
    },
    [],
    [{ displayName }, { policy }, { deliveryPolicy }]
  )

  const prevInstanceTopicAttributes = filter((item) => !isNil(head(values(item))))([
    { displayName: prevInstance.DisplayName },
    { policy: prevInstance.Policy },
    { deliveryPolicy: prevInstance.DeliveryPolicy }
  ])

  // combine inputs and check if something is removed
  const topicAttributesToUpdate = getChangedAttributes(topicAttributes, prevInstanceTopicAttributes)

  await updateTopicAttributes(sns, { topicAttributes: topicAttributesToUpdate, topicArn })

  // flatten delivery status attributes array
  const flatDeliveryStatusAttributes = reduce(
    (result, attribute) =>
      concat(result, map((key) => ({ [key]: attribute[key] }), keys(attribute))),
    [],
    deliveryStatusAttributes
  )

  // combine inputs and check if something is removed and select only ones that differs in state and inputs
  const deliveryStatusAttributesToUpdate = getChangedAttributes(
    flatDeliveryStatusAttributes,
    prevInstance.deliveryStatusAttributes
  )

  // update delivery status attributes
  await updateDeliveryStatusAttributes(sns, {
    deliveryStatusAttributes: deliveryStatusAttributesToUpdate,
    topicArn
  })

  return merge(
    reduce(
      (result, value) => merge({ [head(keys(value))]: head(values(value)) }, result),
      {},
      topicAttributes
    ),
    { deliveryStatusAttributes: flatDeliveryStatusAttributes }
  )
}

const createTopic = async ({
  sns,
  name,
  displayName,
  policy,
  deliveryPolicy,
  deliveryStatusAttributes,
  prevInstance
}) => {
  const { TopicArn: topicArn } = await sns.createTopic({ Name: name }).promise()
  // const topicAttributes = await updateAttributes(
  //   {
  //     displayName,
  //     policy,
  //     deliveryPolicy,
  //     deliveryStatusAttributes,
  //     topicArn
  //   },
  //   prevInstance
  // )
  // return merge({ topicArn, name }, topicAttributes)
  return { topicArn, name }
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
  getTopic,
  resolveArn,
  updateAttributes
}
