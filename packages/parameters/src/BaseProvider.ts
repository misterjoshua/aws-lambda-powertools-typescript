import { strict as assert } from 'assert';
import { fromBase64 } from '@aws-sdk/util-base64-node';
import { ClassForBaseProvider, ExpirableValue, GetMultipleOptionsInterface, GetOptionsInterface } from './types';

const DEFAULT_MAX_AGE_SECS = 5;
const TRANSFORM_METHOD_JSON = 'json';
const TRANSFORM_METHOD_BINARY = 'binary';
const SUPPORTED_TRANSFORM_METHODS = [ TRANSFORM_METHOD_JSON, TRANSFORM_METHOD_BINARY ];
// These providers will be dynamically initialized on first use of the helper functions
const DEFAULT_PROVIDERS = new Map();

class GetOptions implements GetOptionsInterface {
  public forceFetch: boolean = false;
  public maxAge: number = DEFAULT_MAX_AGE_SECS;
  public sdkOptions?: unknown;
  public transform?: string;

  public constructor(options: GetOptionsInterface) {
    Object.assign(this, options);
  }
}

class GetMultipleOptions implements GetMultipleOptionsInterface {
  public forceFetch: boolean = false;
  public maxAge: number = DEFAULT_MAX_AGE_SECS;
  public sdkOptions?: unknown;
  public throwOnTransformError?: boolean = false;
  public transform?: string;

  public constructor(options: GetMultipleOptionsInterface) {
    Object.assign(this, options);
  }
}

abstract class BaseProvider implements ClassForBaseProvider {
  public store: Map<string, ExpirableValue> = new Map;
  
  public abstract _get(name: string, sdkOptions?: unknown): Promise<string | undefined>;

  public abstract _getMultiple(path: string, sdkOptions?: unknown): Promise<Record<string, string|undefined>>;
  
  public async get(name: string, options?: GetOptionsInterface): Promise<void | string | Record<string, unknown>> {
    const configs = new GetOptions(options || {});
    const key = [ name, configs.transform ].toString();

    if (configs.forceFetch === false && this.hasNotExpired(key)) {
      return this.store.get(key)?.value;
    }

    let value;
    try {
      value = await this._get(name, options?.sdkOptions);
    } catch (error) {
      throw error;
    }

    if (value !== undefined && configs.transform !== undefined) {
      value = transformValue(value, configs.transform);
    }

    if (value !== undefined) {
      const ttl = new Date();
      this.store.set(key, {
        value: value,
        ttl: ttl.setSeconds(ttl.getSeconds() + configs.maxAge)
      });
    }

    return value;
  }

  public async getMultiple(path: string, options?: GetMultipleOptionsInterface): Promise<void | Record<string, unknown>> {
    const configs = new GetMultipleOptions(options || {});
    const key = [ path, configs.transform ].toString();

    if (configs.forceFetch === false && this.hasNotExpired(key)) {
      return this.store.get(key)?.value as Record<string, unknown>;
    }

    let values: Record<string, string | undefined> = {};
    try {
      values = await this._getMultiple(path, options?.sdkOptions);
    } catch (error) {
      throw error;
    }

    if (configs.transform !== undefined) {
      Object.keys(values).forEach(key => {
        // TODO: this feature is undocumented in Python and implemented only on getMultiple, check with the team
        const _transform = getTransformMethod(key, configs.transform);
        if (_transform === undefined) {
          return;
        }

        const valueToTransform = values[key];
        if (valueToTransform !== undefined) {
          values[key] = transformValue(valueToTransform, _transform, configs.throwOnTransformError);
        }
      });
    }

    if (Array.from(Object.keys(values)).length !== 0) {
      const ttl = new Date();
      this.store.set(key, {
        value: path,
        ttl: ttl.setSeconds(ttl.getSeconds() + configs.maxAge)
      });
    }

    return values;
  }

  private hasNotExpired(key: string): boolean {
    const potentialValue = this.store.get(key);
    if (potentialValue === undefined) {
      return false;
    } else {
      return potentialValue.ttl > Date.now();
    }
  }

}

const getTransformMethod = (key: string, transform?: string): string | undefined => { 
  if (transform !== 'auto') {
    return transform;
  }

  for (const idx in SUPPORTED_TRANSFORM_METHODS) {
    if (key.endsWith(`.${SUPPORTED_TRANSFORM_METHODS[idx]}`)) {
      return SUPPORTED_TRANSFORM_METHODS[idx];
    }
  }

  return undefined;
};

const transformValue = (value: string, transform: string, throwOnTransformError: boolean = true): string | undefined => {
  const normalizedTrasnform = transform.toLowerCase();
  if (SUPPORTED_TRANSFORM_METHODS.indexOf(normalizedTrasnform) == -1) {
    throw Error(`Invalid transform type ${normalizedTrasnform}.`);
  }
  
  try {
    if (normalizedTrasnform === TRANSFORM_METHOD_JSON) {
      return JSON.parse(value);
    } else if (normalizedTrasnform === TRANSFORM_METHOD_BINARY) {      
      const regex = '(?:[A-Za-z0-9+\\/]{4})*(?:[A-Za-z0-9+\\/]{2}==|[A-Za-z0-9+\/]{3}=)?';
      assert(new RegExp('^' + regex + '$', 'gi').test(value) === true);

      return new TextDecoder('utf-8').decode(fromBase64(value));
    }
  } catch (error) {
    if (throwOnTransformError) {
      throw error;
    }
    
    return;
  }
};

export {
  BaseProvider,
  getTransformMethod,
  transformValue,
  DEFAULT_PROVIDERS
};