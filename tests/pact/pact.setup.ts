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

export const PACT_BROKER_URL = process.env.PACT_BROKER_URL || 'http://192.168.68.69:9292';
export const PACT_BROKER_USERNAME = process.env.PACT_BROKER_USERNAME || 'silver';
export const PACT_BROKER_PASSWORD = process.env.PACT_BROKER_PASSWORD || '135789';
