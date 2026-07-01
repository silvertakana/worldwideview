import { Publisher } from '@pact-foundation/pact-core';
import { PACT_BROKER_URL, PACT_BROKER_USERNAME, PACT_BROKER_PASSWORD } from './pact.setup';

const publisher = new Publisher({
  pactFilesOrDirs: ['./pacts'],
  pactBroker: PACT_BROKER_URL,
  pactBrokerUsername: PACT_BROKER_USERNAME,
  pactBrokerPassword: PACT_BROKER_PASSWORD,
  consumerVersion: process.env.GITHUB_SHA || process.env.GIT_HASH || 'dev',
});

publisher.publish().then(() => {
  console.log('Contract published successfully');
  process.exit(0);
}).catch((err: unknown) => {
  console.error('Failed to publish contract:', err);
  process.exit(1);
});
