const createTopic = async ({ sns, name }) => {
  const { TopicArn: arn } = await sns.createTopic({ Name: name }).promise()
  return arn
}

const removeTopic = async ({ sns, arn }) => {
  await sns.deleteTopic({ TopicArn: arn }).promise()
}

module.exports = {
  createTopic,
  removeTopic
}
