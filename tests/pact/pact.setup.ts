import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import path from 'path';

const { eachLike, like } = MatchersV3;

export const provider = new PactV3({
  consumer: 'WorldWideView',
  provider: 'WWVDataEngine',
  dir: path.resolve(__dirname, '../../pacts'),
  log: path.resolve(__dirname, '../../logs', 'pact.log'),
  host: '127.0.0.1',
});

export const PACT_BROKER_URL =
  process.env.PACT_BROKER_URL || 'http://pactbroker.worldwideview.dev';
export const PACT_BROKER_USERNAME = process.env.PACT_BROKER_USERNAME || '';
export const PACT_BROKER_PASSWORD = process.env.PACT_BROKER_PASSWORD || '';
