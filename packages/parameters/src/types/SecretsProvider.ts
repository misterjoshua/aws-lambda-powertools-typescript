import { GetSecretValueCommandInput } from '@aws-sdk/client-secrets-manager';

type GetSecretValueOptions = Omit<GetSecretValueCommandInput, 'SecretId'>;

export {
  GetSecretValueOptions
};