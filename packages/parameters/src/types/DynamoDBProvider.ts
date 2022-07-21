import { GetItemCommandInput, QueryCommandInput } from '@aws-sdk/client-dynamodb';

type GetItemCommandOptions = Omit<GetItemCommandInput, 'TableName'|'Key'>;

type QueryCommandOptions = Omit<QueryCommandInput, 'TableName'>;

interface AttributesOptions {
  keyAttr?: string
  sortAttr?: string
  valueAttr?: string
}

export {
  GetItemCommandOptions,
  QueryCommandOptions,
  AttributesOptions
};