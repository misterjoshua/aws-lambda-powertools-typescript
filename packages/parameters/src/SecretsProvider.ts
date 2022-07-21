import { GetOptionsInterface } from './types/BaseProvider';
import { GetSecretValueOptions } from './types/SecretsProvider';
import { DEFAULT_PROVIDERS ,BaseProvider } from './BaseProvider';
import { SecretsManagerClient, GetSecretValueCommand, SecretsManagerClientConfig } from '@aws-sdk/client-secrets-manager';

class SecretsProvider extends BaseProvider {
  public client: SecretsManagerClient;

  public constructor(config: SecretsManagerClientConfig = {}) {
    super();
    this.client = new SecretsManagerClient(config);
  }

  public async _get(name: string, sdkOptions: GetSecretValueOptions = {}): Promise<string | undefined> {
    // Explicit arguments will take precendence over sdkOptions arguments
    const commandInput = Object.assign(sdkOptions, {
      SecretId: name
    });
    const result = await this.client.send(new GetSecretValueCommand(commandInput));
    
    return result.SecretString;
  }

  public _getMultiple(_path: string): Promise<Record<string, string | undefined>> {
    throw Error('Not implemented.');
  }
}

const get_secret = async (name: string, options?: GetOptionsInterface): Promise<void | string | Record<string, unknown>> => {
  // Only create the provider if this function is called at least once
  if (!DEFAULT_PROVIDERS.has('secrets')) {
    DEFAULT_PROVIDERS.set('secrets', new SecretsProvider());
  }

  return await DEFAULT_PROVIDERS.get('secrets').get(name, options);
};

export {
  SecretsProvider,
  get_secret
};