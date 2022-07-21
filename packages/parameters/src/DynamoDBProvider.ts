import { BaseProvider } from './BaseProvider';
import { AttributesOptions, GetItemCommandOptions, QueryCommandOptions } from './types/DynamoDBProvider';
import { DynamoDBClient, DynamoDBClientConfig, GetItemCommand, QueryCommand, QueryCommandInput, QueryCommandOutput } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

class DynamoDBProvider extends BaseProvider {
  public client: DynamoDBClient;
  
  public keyAttr: string = 'id';
  
  public sortAttr: string = 'sk';
  
  public tableName?: string;

  public valueAttr: string = 'value';

  public constructor(tableName: string, attributes: AttributesOptions = {}, config: DynamoDBClientConfig = {}) {
    super();
    this.client = new DynamoDBClient(config);

    this.tableName = tableName;
    Object.assign(this, attributes);
  }

  public async _get(name: string, sdkOptions: GetItemCommandOptions = {}): Promise<string | undefined> {
    // Explicit arguments will take precendence over sdkOptions arguments
    const commandInput = Object.assign(sdkOptions, {
      TableName: this.tableName,
      Key: marshall({
        [this.keyAttr]: name
      })
    });

    const result = await this.client.send(new GetItemCommand(commandInput));
    
    if (result.Item !== undefined) {
      const item = unmarshall(result.Item);
      
      return item[this.valueAttr];
    }
  }

  public async _getMultiple(path: string, sdkOptions: QueryCommandOptions = {}): Promise<Record<string, string | undefined>> {
    // Explicit arguments will take precendence over sdkOptions arguments
    const commandInput = Object.assign(sdkOptions, {
      TableName: this.tableName,
      KeyConditionExpression: `#keyAttr = :path`,
      ExpressionAttributeValues: marshall({ ':path': path }),
      ExpressionAttributeNames: { '#keyAttr': this.keyAttr }
    });

    const items: Record<string, string | undefined> = {};
    await this.query(commandInput, items);

    return items;
  }

  private async formatResult(result: QueryCommandOutput, items: Record<string, string | undefined>): Promise<Record<string, string | undefined>> {
    if (result.Items !== undefined && result.Count !== 0) {
      result.Items.forEach(item => {
        const itemUnmarshalled = unmarshall(item);
        items[itemUnmarshalled[this.sortAttr]] = itemUnmarshalled[this.valueAttr];
      });
    }

    return items;
  }

  private async query(commandInput: QueryCommandInput, items: Record<string, string | undefined>): Promise<Record<string, string | undefined>> {
    const result = await this.client.send(new QueryCommand(commandInput));
    this.formatResult(result, items);
    if (result.LastEvaluatedKey !== undefined) {
      commandInput.ExclusiveStartKey = result.LastEvaluatedKey;
      await this.query(commandInput, items);
    }

    return items;
  }
}

export {
  DynamoDBProvider
};