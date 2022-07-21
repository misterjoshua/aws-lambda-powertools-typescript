/**
 * Test SecretsProvider class
 *
 * @group unit/parameters/secretsProvider/class
 */

import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { SecretsProvider } from '../../src/SecretsProvider';

const clientSpy = jest.spyOn(SecretsManagerClient.prototype, 'send').mockImplementation(() => ({ SecretString: 'foo', }));

describe('Class: SecretsProvider', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Method: get', () => {
    test('when called, and the cache is empty, it returns a value from remote', async () => {

      // Prepare
      const provider = new SecretsProvider();

      // Act
      const value = await provider.get('my-parameter');

      // Assess
      expect(value).toEqual('foo');
      expect(clientSpy).toBeCalledWith(expect.objectContaining({
        input: expect.objectContaining({
          SecretId: 'my-parameter'
        })
      }));

    });

    test('when called, and a non-expired value exists in the cache, it returns it', async () => {

      // Prepare
      const provider = new SecretsProvider();
      const ttl = new Date();
      provider.store.set([ 'my-parameter', undefined ].toString(), { value: 'bar', ttl: ttl.setSeconds(ttl.getSeconds() + 600) });

      // Act
      const value = await provider.get('my-parameter');

      // Assess
      expect(value).toEqual('bar');
      expect(clientSpy).toBeCalledTimes(0);

    });

    test('when called, and an expired value exists in the cache, it returns a value from remote', async () => {

      // Prepare
      const provider = new SecretsProvider();
      const ttl = new Date();
      provider.store.set([ 'my-parameter', undefined ].toString(), { value: 'bar', ttl: ttl.setSeconds(ttl.getSeconds() - 600) });

      // Act
      const value = await provider.get('my-parameter');

      // Assess
      expect(value).toEqual('foo');
      expect(clientSpy).toBeCalledTimes(1);

    });

    test('when called with custom sdkOptions, it uses them, and it returns a value from remote', async () => {

      // Prepare
      const provider = new SecretsProvider();

      // Act
      const value = await provider.get('my-parameter', { sdkOptions: {
        VersionId: '7a9155b8-2dc9-466e-b4f6-5bc46516c84d'
      } });

      // Assess
      expect(value).toEqual('foo');
      expect(clientSpy).toBeCalledWith(expect.objectContaining({
        input: expect.objectContaining({
          SecretId: 'my-parameter',
          VersionId: '7a9155b8-2dc9-466e-b4f6-5bc46516c84d'
        })
      }));

    });

    test('when called with custom sdkOptions that should be overwritten, it use the correct ones, and it returns a value from remote', async () => {

      // Prepare
      const provider = new SecretsProvider();

      // Act
      const value = await provider.get('my-parameter', { sdkOptions: {
        SecretId: 'THIS_SHOULD_BE_OVERWRITTEN',
        VersionId: '7a9155b8-2dc9-466e-b4f6-5bc46516c84d'
      } });

      // Assess
      expect(value).toEqual('foo');
      expect(clientSpy).toBeCalledWith(expect.objectContaining({
        input: expect.objectContaining({
          SecretId: 'my-parameter',
          VersionId: '7a9155b8-2dc9-466e-b4f6-5bc46516c84d'
        })
      }));

    });

  });

  describe('Method: getMultiple', () => {
    test('when called, it throws', async () => {

      // Prepare
      const provider = new SecretsProvider();

      // Act / Assess
      await expect(provider.getMultiple('my-path')).rejects.toThrowError(Error);

    });

  });

});