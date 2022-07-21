interface GetOptionsInterface {
  maxAge?: number
  forceFetch?: boolean
  sdkOptions?: unknown
  transform?: string
}

interface GetMultipleOptionsInterface {
  maxAge?: number
  forceFetch?: boolean
  sdkOptions?: unknown
  transform?: string
  throwOnTransformError?: boolean
}

type ClassForBaseProvider = {
  get(name: string, options?: GetOptionsInterface): Promise<void | string | Record<string, unknown>>
  getMultiple(path: string, options?: GetMultipleOptionsInterface): Promise<void | Record<string, unknown>>
};

type ExpirableValue = {
  value: string | Record<string, unknown>
  ttl: number
};

export {
  GetOptionsInterface,
  GetMultipleOptionsInterface,
  ClassForBaseProvider,
  ExpirableValue
};