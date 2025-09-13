const awsExports = {
  aws_project_region: 'us-east-1',
  aws_appsync_graphqlEndpoint: process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_ENDPOINT,
  aws_appsync_region: 'us-east-1',
  aws_appsync_authenticationType: 'API_KEY',
  aws_appsync_apiKey: process.env.NEXT_PUBLIC_APPSYNC_API_KEY
};

export default awsExports;
