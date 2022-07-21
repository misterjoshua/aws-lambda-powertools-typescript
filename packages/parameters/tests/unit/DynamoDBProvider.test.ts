/**
 * Test DynamoDBProvider class
 *
 * @group unit/parameters/dynamoDBProvider/class
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBProvider } from '../../src/DynamoDBProvider';
import { marshall } from '@aws-sdk/util-dynamodb';
import { toBase64 } from '@aws-sdk/util-base64-node';

const clientSpy = jest.spyOn(DynamoDBClient.prototype, 'send');

describe('Class: DynamoDBProvider', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Method: init', () => {

    test('when initialized, it sets the tableName correctly', () => {
      
      // Prepare
      const provider = new DynamoDBProvider('TestTable');

      // Act / Assess
      expect(provider.tableName).toEqual('TestTable');
    
    });

    test('when initialized, and no attributes are passed, it uses the default values', () => {
      
      // Prepare
      const provider = new DynamoDBProvider('TestTable');

      // Act / Assess
      expect(provider.keyAttr).toEqual('id');
      expect(provider.sortAttr).toEqual('sk');
      expect(provider.valueAttr).toEqual('value');

    });

    test('when initialized, and ALL attributes are passed, it overwrites ALL the default values', () => {
      
      // Prepare
      const provider = new DynamoDBProvider('TestTable', {
        keyAttr: 'foo',
        sortAttr: 'bar',
        valueAttr: 'baz'
      });

      // Act / Assess
      expect(provider.keyAttr).toEqual('foo');
      expect(provider.sortAttr).toEqual('bar');
      expect(provider.valueAttr).toEqual('baz');

    });

    test('when initialized, and SOME attributes are passed, it PARTIALLY overwrites the correct default values', () => {
      
      // Prepare
      const provider = new DynamoDBProvider('TestTable', {
        sortAttr: 'bar',
      });

      // Act / Assess
      expect(provider.keyAttr).toEqual('id');
      expect(provider.sortAttr).toEqual('bar');
      expect(provider.valueAttr).toEqual('value');

    });

  });

  describe('Method: get', () => {
    
    test('when called, and the cache is empty, it returns a value from remote', async () => {

      // Prepare
      const provider = new DynamoDBProvider('TestTable');
      clientSpy.mockImplementation(() => ({ 'Item': { ...marshall({ 'id': 'my-parameter' }), ...marshall({ 'value': 'foo' }) } }));

      // Act
      const value = await provider.get('my-parameter');

      // Assess
      expect(value).toEqual('foo');
      expect(clientSpy).toBeCalledWith(expect.objectContaining({
        input: expect.objectContaining({
          TableName: 'TestTable',
          Key: {
            'id': {
              S: 'my-parameter'
            }
          }
        })
      }));

    });

    test('when called, and a non-expired value exists in the cache, it returns it', async () => {

      // Prepare
      const provider = new DynamoDBProvider('TestTable');
      clientSpy.mockImplementation(() => ({ 'Item': { ...marshall({ 'id': 'my-parameter' }), ...marshall({ 'value': 'foo' }) } }));
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
      const provider = new DynamoDBProvider('TestTable');
      clientSpy.mockImplementation(() => ({ 'Item': { ...marshall({ 'id': 'my-parameter' }), ...marshall({ 'value': 'foo' }) } }));
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
      const provider = new DynamoDBProvider('TestTable');
      clientSpy.mockImplementation(() => ({ 'Item': { ...marshall({ 'id': 'my-parameter' }), ...marshall({ 'value': 'foo' }) } }));

      // Act
      const value = await provider.get('my-parameter', { sdkOptions: { Limit: 1 } });

      // Assess
      expect(value).toEqual('foo');
      expect(clientSpy).toBeCalledWith(expect.objectContaining({
        input: expect.objectContaining({
          Limit: 1
        })
      }));

    });

    test('when called with custom sdkOptions that should be overwritten, it use the correct ones, and it returns a value from remote', async () => {

      // Prepare
      const provider = new DynamoDBProvider('TestTable');
      clientSpy.mockImplementation(() => ({ 'Item': { ...marshall({ 'id': 'my-parameter' }), ...marshall({ 'value': 'foo' }) } }));

      // Act
      const value = await provider.get('my-parameter', { sdkOptions: { TableName: 'THIS_SHOULD_BE_OVERWRITTEN', Limit: 1 } });

      // Assess
      expect(value).toEqual('foo');
      expect(clientSpy).toBeCalledWith(expect.objectContaining({
        input: expect.objectContaining({
          TableName: 'TestTable',
          Limit: 1
        })
      }));

    });

    test('when called, and the parameter DOES NOT exist, it returns undefined', async () => {

      // Prepare
      const provider = new DynamoDBProvider('TestTable');
      clientSpy.mockImplementation(() => ({}));

      // Act
      const value = await provider.get('my-parameter');

      // Assess
      expect(value).toBeUndefined();
      expect(clientSpy).toBeCalledTimes(1);

    });
  
  });

  describe('Method: getMultiple', () => {
    
    test('when called, and the cache is empty, it returns a values from remote', async () => {

      // Prepare
      const provider = new DynamoDBProvider('TestTable');
      clientSpy.mockImplementation(() => ({ 'Items': [
        { ...marshall({ 'id': 'my-parameter' }), ...marshall({ 'sk': 'param-a' }), ...marshall({ 'value': 'foo' }) },
        { ...marshall({ 'id': 'my-parameter' }), ...marshall({ 'sk': 'param-b' }), ...marshall({ 'value': 'bar' }) }
      ] }));

      // Act
      const value = await provider.getMultiple('my-path');

      // Assess
      expect(value).toEqual({
        'param-a': 'foo',
        'param-b': 'bar'
      });
      expect(clientSpy).toBeCalledWith(expect.objectContaining({
        input: expect.objectContaining({
          TableName: 'TestTable',
          ExpressionAttributeNames: {
            '#keyAttr': 'id'
          },
          ExpressionAttributeValues: {
            ':path': {
              S: 'my-path'
            }
          }
        })
      }));

    });

    test('when called with transform auto, it returns all the values transformed correctly ', async () => {

      // Prepare
      const encoder = new TextEncoder();
      const mockData = JSON.stringify({ foo: 'bar' });
      const mockBinary = toBase64(encoder.encode('my-value'));
      const provider = new DynamoDBProvider('TestTable');
      clientSpy.mockImplementation(() => ({ 'Items': [
        { ...marshall({ 'id': 'my-parameter' }), ...marshall({ 'sk': 'param-a.json' }), ...marshall({ 'value': mockData }) },
        { ...marshall({ 'id': 'my-parameter' }), ...marshall({ 'sk': 'param-b.binary' }), ...marshall({ 'value': mockBinary }) }
      ] }));

      // Act
      const value = await provider.getMultiple('my-path', { transform: 'auto' });
  
      // Assess
      expect(value).toEqual({
        'param-a.json': { foo: 'bar' },
        'param-b.binary': 'my-value'
      });
  
    });

    test('when called, and NOT all the parameters are retrieved in a single request, it keeps querying until it returns all the values', async () => {

      // Prepare
      const provider = new DynamoDBProvider('TestTable');
      clientSpy
        .mockImplementationOnce(() => ({
          'Items': [
            { ...marshall({ 'id': 'my-parameter' }), ...marshall({ 'sk': 'param-a' }), ...marshall({ 'value': 'foo' }) },
          ],
          'LastEvaluatedKey': { ...marshall({ 'id': 'my-parameter' }), ...marshall({ 'sk': 'param-a' }), ...marshall({ 'value': 'foo' }) }
        }))
        .mockImplementationOnce(() => ({
          'Items': [
            { ...marshall({ 'id': 'my-parameter' }), ...marshall({ 'sk': 'param-b' }), ...marshall({ 'value': 'bar' }) }
          ]
        }));

      // Act
      const value = await provider.getMultiple('my-path');

      // Assess
      expect(value).toEqual({
        'param-a': 'foo',
        'param-b': 'bar'
      });
      expect(clientSpy).toBeCalledTimes(2);
      // First Call
      expect(clientSpy).toBeCalledWith(expect.objectContaining({
        input: expect.objectContaining({
          TableName: 'TestTable',
          ExpressionAttributeNames: {
            '#keyAttr': 'id'
          },
          ExpressionAttributeValues: {
            ':path': {
              S: 'my-path'
            }
          }
        })
      }));
      // Second Call
      expect(clientSpy).toBeCalledWith(expect.objectContaining({
        input: expect.objectContaining({
          TableName: 'TestTable',
          ExpressionAttributeNames: {
            '#keyAttr': 'id'
          },
          ExpressionAttributeValues: {
            ':path': {
              S: 'my-path'
            }
          },
          ExclusiveStartKey: {
            'id': {
              S: 'my-parameter'
            },
            'sk': {
              S: 'param-a'
            },
            'value': {
              S: 'foo'
            }
          }
        })
      }));
  
    });

    test('when called, and NO results are returned, it returns an empty object', async () => {

      // Prepare
      const provider = new DynamoDBProvider('TestTable');
      clientSpy
        .mockImplementationOnce(() => ({
          'Items': [],
          'Count': 0
        }));

      // Act
      const value = await provider.getMultiple('my-path');

      // Assess
      expect(value).toEqual({});
      expect(clientSpy).toBeCalledTimes(1);
  
    });

  });

});