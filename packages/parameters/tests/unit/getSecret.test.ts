/**
 * Test getSecret function
 *
 * @group unit/parameters/getSecret/function
 */

import { BaseProvider } from '../../src';
import { DEFAULT_PROVIDERS } from '../../src/BaseProvider';
import { getSecret } from '../../src/SecretsProvider';

const defaultProviderGetSpy = jest.spyOn(DEFAULT_PROVIDERS, 'get');
const defaultProviderHasSpy = jest.spyOn(DEFAULT_PROVIDERS, 'has');

describe('Function: getSecret', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Function: getSecret', () => {

    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('when called and a default provider DOES NOT exist, it creates one, and returns the value', async () => {

      // Prepare
      defaultProviderHasSpy.mockReturnValue(false);
    
      // Act
      const value = await getSecret('my-parameter');

      // Assess
      expect(value).toEqual('foo');

    });

    test('when called and a default provider exists, it uses it, and returns the value', async () => {

      // Prepare
      class TestProvider extends BaseProvider {
        public async _get(_name: string): Promise<string> {
          return new Promise((resolve, _reject) => resolve('foo'));
        }

        public _getMultiple(_path: string): Promise<Record<string, string>> {
          throw Error('Not implemented.');
        }
      }
      const provider = new TestProvider();
      defaultProviderHasSpy.mockReturnValue(true);
      defaultProviderGetSpy.mockReturnValue(provider);

      // Act
      const value = await getSecret('my-parameter');

      // Assess
      expect(value).toEqual('foo');
    
    });

  });
});