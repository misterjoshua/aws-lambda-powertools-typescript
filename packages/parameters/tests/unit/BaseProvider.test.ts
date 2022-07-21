/**
 * Test BaseProvider class
 *
 * @group unit/parameters/baseProvider/class
 */

import { BaseProvider } from '../../src';
import { toBase64 } from '@aws-sdk/util-base64-node';
import { AssertionError } from 'node:assert';

const encoder = new TextEncoder();

describe('Class: BaseProvider', () => {

  describe('Method: get', () => {

    test('when it raises an error, the error bubbles up', async () => {

      // Prepare
      class TestProvider extends BaseProvider {
        public async _get(_name: string): Promise<string> {
          throw Error('Some error.');
        }

        public _getMultiple(_path: string): Promise<Record<string, string>> {
          throw Error('Not implemented.');
        }
      }
      const provider = new TestProvider();

      // Act / Assess
      expect.assertions(1);
      try {
        await provider.get('my-parameter');
      } catch (error) {
        expect(error).toEqual(Error('Some error.'));
      }

    });

    test('when called with an unsupported transform, it throws', async () => {

      // Prepare
      const mockData = JSON.stringify({ foo: 'bar' });
      class TestProvider extends BaseProvider {
        public async _get(_name: string): Promise<string> {
          return new Promise((resolve, _reject) => resolve(mockData));
        }

        public _getMultiple(_path: string): Promise<Record<string, string>> {
          throw Error('Not implemented.');
        }
      }
      const provider = new TestProvider();

      // Act / Assess
      expect.assertions(1);
      try {
        await provider.get('my-parameter', { transform: 'foo' });
      } catch (error) {
        expect(error).toEqual(Error('Invalid transform type foo.'));
      }

    });

    test('when called and a cached value is available, it returns an the cached value', async () => {

      // Prepare
      class TestProvider extends BaseProvider {
        public _get(_name: string): Promise<string> {
          throw Error('Not implemented.');
        }
        
        public _getMultiple(_path: string): Promise<Record<string, string>> {
          throw Error('Not implemented.');
        }
      }
      const provider = new TestProvider();
      const ttl = new Date();
      provider.store.set([ 'my-parameter', undefined ].toString(), { value: 'my-value', ttl: ttl.setSeconds(ttl.getSeconds() + 600) });
  
      // Act
      const values = await provider.get('my-parameter');
  
      // Assess
      expect(values).toEqual('my-value');

    });

    test('when called with a json transform, and the value is a valid string representation of a JSON, it returns an object', async () => {

      // Prepare
      const mockData = JSON.stringify({ foo: 'bar' });
      class TestProvider extends BaseProvider {
        public _get(_name: string): Promise<string> {
          return new Promise((resolve, _reject) => resolve(mockData));
        }

        public _getMultiple(_path: string): Promise<Record<string, string>> {
          throw Error('Not implemented.');
        }
      }
      const provider = new TestProvider();

      // Act
      const value = await provider.get('my-parameter', { transform: 'json' });

      // Assess
      expect(typeof value).toBe('object');
      expect(value).toMatchObject({
        'foo': 'bar'
      });

    });
    
    test('when called with a json transform, and the value is NOT a valid string representation of a JSON, it throws', async () => {

      // Prepare
      const mockData = `${JSON.stringify({ foo: 'bar' })}{`;
      class TestProvider extends BaseProvider {
        public _get(_name: string): Promise<string> {
          return new Promise((resolve, _reject) => resolve(mockData));
        }

        public _getMultiple(_path: string): Promise<Record<string, string>> {
          throw Error('Not implemented.');
        }
      }
      const provider = new TestProvider();

      // Act / Assess
      await expect(provider.get('my-parameter', { transform: 'json' })).rejects.toThrowError(SyntaxError);

    });

    test('when called with a binary transform, and the value is a valid string representation of a binary, it returns the decoded value', async () => {
      // Prepare
      const mockBinary = toBase64(encoder.encode('my-value'));
      class TestProvider extends BaseProvider {
        public _get(_name: string): Promise<string> {
          return new Promise((resolve, _reject) => resolve(mockBinary));
        }

        public _getMultiple(_path: string): Promise<Record<string, string>> {
          throw Error('Not implemented.');
        }
      }
      const provider = new TestProvider();

      // Act
      const value = await provider.get('my-parameter', { transform: 'binary' });

      // Assess
      expect(typeof value).toBe('string');
      expect(value).toEqual('my-value');

    });

    test('when called with a binary transform, and the value is NOT a valid string representation of a binary, it throws', async () => {

      // Prepare
      const mockBinary = 'qw';
      class TestProvider extends BaseProvider {
        public _get(_name: string): Promise<string> {
          return new Promise((resolve, _reject) => resolve(mockBinary));
        }

        public _getMultiple(_path: string): Promise<Record<string, string>> {
          throw Error('Not implemented.');
        }
      }
      const provider = new TestProvider();

      // Act / Assess
      await expect(provider.get('my-parameter', { transform: 'binary' })).rejects.toThrowError(AssertionError);

    });

  });

  describe('Method: getMultiple', () => {
    test('when it raises an error, the error bubbles up', async () => {
      
      // Prepare
      class TestProvider extends BaseProvider {
        public _get(_name: string): Promise<string> {
          throw Error('Not implemented.');
        }

        public _getMultiple(_path: string): Promise<Record<string, string>> {
          throw Error('Some error.');
        }
      }
      const provider = new TestProvider();

      // Act / Assess
      await expect(provider.getMultiple('my-parameter')).rejects.toThrowError(Error);

    });

    test('when called with a json transform, and all the values are a valid string representation of a JSON, it returns an object with all the values', async () => {

      // Prepare
      const mockData = JSON.stringify({ foo: 'bar' });
      class TestProvider extends BaseProvider {
        public _get(_name: string): Promise<string> {
          throw Error('Not implemented.');
        }
        
        public _getMultiple(_path: string): Promise<Record<string, string>> {
          return new Promise((resolve, _reject) => resolve({ 'A': mockData }));
        }
      }
      const provider = new TestProvider();
      
      // Act
      const values = await provider.getMultiple('my-path', { transform: 'json' });
      
      // Assess
      expect(typeof values).toBe('object');
      expect(values).toMatchObject({
        'A': {
          'foo': 'bar'
        }
      });
      
    });
    
    test('when called, it returns an object with the values', async () => {

      // Prepare
      class TestProvider extends BaseProvider {
        public _get(_name: string): Promise<string> {
          throw Error('Not implemented.');
        }
        
        public _getMultiple(_path: string): Promise<Record<string, string>> {
          return new Promise((resolve, _reject) => resolve({ 'A': 'foo', 'B': 'bar' }));
        }
      }
      const provider = new TestProvider();

      // Act
      const values = await provider.getMultiple('my-path');

      // Assess
      expect(typeof values).toBe('object');
      expect(values).toMatchObject({
        'A': 'foo',
        'B': 'bar'
      });

    });

    test('when called with a json transform, and one of the values is NOT a valid string representation of a JSON, it returns an object with partial failures', async () => {

      // Prepare
      const mockData = JSON.stringify({ foo: 'bar' });
      class TestProvider extends BaseProvider {
        public _get(_name: string): Promise<string> {
          throw Error('Not implemented.');
        }
        
        public _getMultiple(_path: string): Promise<Record<string, string>> {
          return new Promise((resolve, _reject) => resolve({ 'A': mockData, 'B': `${mockData}{` }));
        }
      }
      const provider = new TestProvider();

      // Act
      const values = await provider.getMultiple('my-path', { transform: 'json' });

      // Assess
      expect(typeof values).toBe('object');
      expect(values).toMatchObject({
        'A': {
          'foo': 'bar'
        },
        'B': undefined
      });

    });

    test('when called with a json transform and throwOnTransformError, and at least ONE the values is NOT a valid string representation of a JSON, it throws', async () => {

      // Prepare
      const mockData = JSON.stringify({ foo: 'bar' });
      class TestProvider extends BaseProvider {
        public _get(_name: string): Promise<string> {
          throw Error('Not implemented.');
        }
        
        public _getMultiple(_path: string): Promise<Record<string, string>> {
          return new Promise((resolve, _reject) => resolve({ 'A': `${mockData}{` }));
        }
      }
      const provider = new TestProvider();

      // Act / Assess
      await expect(provider.getMultiple('my-path', { transform: 'json', throwOnTransformError: true })).rejects.toThrowError(SyntaxError);

    });

    test('when called with a binary transform, and all the values are a valid string representation of a binary, it returns an object with all the values', async () => {

      // Prepare
      const mockBinary = toBase64(encoder.encode('my-value'));
      class TestProvider extends BaseProvider {
        public _get(_name: string): Promise<string> {
          throw Error('Not implemented.');
        }
        
        public _getMultiple(_path: string): Promise<Record<string, string>> {
          return new Promise((resolve, _reject) => resolve({ 'A': `${mockBinary}` }));
        }
      }
      const provider = new TestProvider();

      // Act
      const values = await provider.getMultiple('my-path', { transform: 'binary' });

      // Assess
      expect(typeof values).toBe('object');
      expect(values).toMatchObject({
        'A': 'my-value'
      });

    });

    test('when called with a binary transform, and one of the values is NOT a valid string representation of a binary, it returns an object with partial failures', async () => {

      // Prepare
      const mockBinary = toBase64(encoder.encode('my-value'));
      class TestProvider extends BaseProvider {
        public _get(_name: string): Promise<string> {
          throw Error('Not implemented.');
        }
        
        public _getMultiple(_path: string): Promise<Record<string, string>> {
          return new Promise((resolve, _reject) => resolve({ 'A': mockBinary, 'B': 'qw' }));
        }
      }
      const provider = new TestProvider();

      // Act
      const values = await provider.getMultiple('my-path', { transform: 'binary' });

      // Assess
      expect(typeof values).toBe('object');
      expect(values).toMatchObject({
        'A': 'my-value',
        'B': undefined
      });

    });

    test('when called with a binary transform and throwOnTransformError, and at least ONE the values is NOT a valid string representation of a binary, it throws', async () => {

      // Prepare
      class TestProvider extends BaseProvider {
        public _get(_name: string): Promise<string> {
          throw Error('Not implemented.');
        }
        
        public _getMultiple(_path: string): Promise<Record<string, string>> {
          return new Promise((resolve, _reject) => resolve({ 'A': 'qw' }));
        }
      }
      const provider = new TestProvider();

      // Act / Assess
      await expect(provider.getMultiple('my-path', { transform: 'binary', throwOnTransformError: true })).rejects.toThrowError(AssertionError);

    });

    test('when called with auto transform and the key of the parameter ends with `.binary`, and all the values are a valid string representation of a binary, it returns an object with all the transformed values', async () => {

      // Prepare
      const mockBinary = toBase64(encoder.encode('my-value'));
      class TestProvider extends BaseProvider {
        public _get(_name: string): Promise<string> {
          throw Error('Not implemented.');
        }
        
        public _getMultiple(_path: string): Promise<Record<string, string>> {
          return new Promise((resolve, _reject) => resolve({ 'A.binary': mockBinary }));
        }
      }
      const provider = new TestProvider();

      // Act
      const values = await provider.getMultiple('my-path', { transform: 'auto' });

      // Assess
      expect(typeof values).toBe('object');
      expect(values).toMatchObject({
        'A.binary': 'my-value'
      });

    });

    test('when called with auto transform and the key of the parameter DOES NOT end with `.binary` or `.json`, it returns an object with all the values NOT transformed', async () => {

      // Prepare
      const mockBinary = toBase64(encoder.encode('my-value'));
      class TestProvider extends BaseProvider {
        public _get(_name: string): Promise<string> {
          throw Error('Not implemented.');
        }
        
        public _getMultiple(_path: string): Promise<Record<string, string>> {
          return new Promise((resolve, _reject) => resolve({ 'A.foo': mockBinary }));
        }
      }
      const provider = new TestProvider();

      // Act
      const values = await provider.getMultiple('my-path', { transform: 'auto' });

      // Assess
      expect(typeof values).toBe('object');
      expect(values).toMatchObject({
        'A.foo': mockBinary
      });

    });

    test('when called with a binary transform, and at least ONE the values is undefined, it returns an object with one of the values undefined', async () => {

      // Prepare
      class TestProvider extends BaseProvider {
        public _get(_name: string): Promise<string> {
          throw Error('Not implemented.');
        }
        
        public _getMultiple(_path: string): Promise<Record<string, string|undefined>> {
          return new Promise((resolve, _reject) => resolve({ 'A': undefined }));
        }
      }
      const provider = new TestProvider();

      // Act
      const values = await provider.getMultiple('my-path', { transform: 'auto' });

      expect(typeof values).toBe('object');
      expect(values).toMatchObject({
        'A': undefined
      });

    });

    test('when called and values cached are available, it returns an object with the cached values', async () => {

      // Prepare
      class TestProvider extends BaseProvider {
        public _get(_name: string): Promise<string> {
          throw Error('Not implemented.');
        }
        
        public _getMultiple(_path: string): Promise<Record<string, string>> {
          throw Error('Not implemented.');
        }
      }
      const provider = new TestProvider();
      const ttl = new Date();
      provider.store.set([ 'my-path', undefined ].toString(), { value: { 'A': 'my-value' }, ttl: ttl.setSeconds(ttl.getSeconds() + 600) });

      // Act
      const values = await provider.getMultiple('my-path');

      // Assess
      expect(typeof values).toBe('object');
      expect(values).toMatchObject({
        'A': 'my-value',
      });

    });

    test('when called and values cached are expired, it returns an object with the remote values', async () => {

      // Prepare
      class TestProvider extends BaseProvider {
        public _get(_name: string): Promise<string> {
          throw Error('Not implemented.');
        }
        
        public _getMultiple(_path: string): Promise<Record<string, string>> {
          return new Promise((resolve, _reject) => resolve({ 'A': 'my-value' }));
        }
      }
      const provider = new TestProvider();
      const ttl = new Date();
      provider.store.set([ 'my-path', undefined ].toString(), { value: { 'B': 'my-other-value' }, ttl: ttl.setSeconds(ttl.getSeconds() - 600) });

      // Act
      const values = await provider.getMultiple('my-path');

      // Assess
      expect(typeof values).toBe('object');
      expect(values).toMatchObject({
        'A': 'my-value',
      });

    });

  });

});