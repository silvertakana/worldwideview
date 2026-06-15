import { provider } from './pact.setup';
import { MatchersV3 } from '@pact-foundation/pact';

const { like } = MatchersV3;

describe('Data Engine Health endpoint', () => {
  test('returns healthy status', async () => {
    const expectedBody = {
      status: like('ok'),
      engine: like('wwv-data-engine'),
      timestamp: like(1234567890123),
      seeders: like({}),
    };

    await provider
      .given('the service is healthy')
      .uponReceiving('a request for health status')
      .withRequest({
        method: 'GET',
        path: '/health',
        headers: { Accept: 'application/json' },
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: expectedBody,
      });

    await provider.executeTest(async (mockServer) => {
      const response = await fetch(`${mockServer.url}/health`, {
        headers: { Accept: 'application/json' },
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('engine');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('seeders');
    });
  });
});
