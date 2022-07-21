import AWS, { XRay } from 'aws-sdk';
import promiseRetry from 'promise-retry';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import {
  invokeFunction, TestRuntimesKey, TEST_RUNTIMES,
} from '../../../commons/tests/utils/e2eUtils';
import { Duration, Stack } from 'aws-cdk-lib';
import { Architecture, Tracing } from 'aws-cdk-lib/aws-lambda';
import { 
  expectedCustomAnnotationKey, 
  expectedCustomAnnotationValue, 
  expectedCustomMetadataKey, 
  expectedCustomMetadataValue, 
  expectedCustomResponseValue, 
  expectedCustomErrorMessage,
} from '../e2e/constants';
import { FunctionSegmentNotDefinedError } from './FunctionSegmentNotDefinedError';
interface ParsedDocument {
  name: string
  id: string
  start_time: number
  end_time?: number
  // This flag may be set if the segment hasn't been fully processed
  // The trace may have already appeared in the `getTraceSummaries` response 
  // but a segment may still be in_progress
  in_progress?: boolean 
  aws?: {
    request_id: string
  }
  http?: {
    response: {
      status: number
    }
  }
  origin?: string
  resource_arn?: string
  trace_id?: string
  subsegments?: ParsedDocument[]
  annotations?: {
    [key: string]: string | boolean | number
  }
  metadata?: {
    [key: string]: {
      [key: string]: unknown
    }
  }
  fault?: boolean
  cause?: {
    working_directory: string
    exceptions: {
      message: string
      type: string
      remote: boolean
      stack: {
        path: string
        line: number
        label: string
      }[]
    }[]
  }
  exception: {
    message: string
  }
  error?: boolean
}

interface ParsedSegment {
  Document: ParsedDocument
  Id: string
}

export interface ParsedTrace {
  Duration: number
  Id: string
  LimitExceeded: boolean
  Segments: ParsedSegment[]
}

interface TracerTestFunctionParams { 
  stack: Stack
  functionName: string
  entry: string
  expectedServiceName: string
  environmentParams: { [key: string]: string }
  runtime: string
}

const getTraces = async (xrayClient: XRay, startTime: Date, resourceArn: string, expectedTraces: number, expectedSegments: number): Promise<ParsedTrace[]> => {
  const retryOptions = { retries: 20, minTimeout: 5_000, maxTimeout: 10_000, factor: 1.25 };

  return promiseRetry(async(retry: (err?: Error) => never , _: number) => {

    const endTime = new Date();
    console.log(`Manual query: aws xray get-trace-summaries --start-time ${Math.floor(startTime.getTime() / 1000)} --end-time ${Math.floor(endTime.getTime() / 1000)} --filter-expression 'resource.arn = "${resourceArn}"'`);
    const traces = await xrayClient
      .getTraceSummaries({
        StartTime: startTime,
        EndTime: endTime,
        FilterExpression: `resource.arn = "${resourceArn}"`,
      })
      .promise();

    if (traces.TraceSummaries?.length !== expectedTraces) {
      retry(new Error(`Expected ${expectedTraces} traces, got ${traces.TraceSummaries?.length} for ${resourceArn}`));
    }

    const traceDetails = await xrayClient.batchGetTraces({
      TraceIds: traces.TraceSummaries?.map((traceSummary) => traceSummary?.Id) as XRay.TraceIdList,
    }).promise();

    if (traceDetails.Traces?.length !== expectedTraces) {
      retry(new Error(`Expected ${expectedTraces} trace summaries, got ${traceDetails.Traces?.length} for ${resourceArn}`));
    }

    const sortedTraces = traceDetails.Traces?.map((trace): ParsedTrace => ({
      Duration: trace?.Duration as number,
      Id: trace?.Id as string,
      LimitExceeded: trace?.LimitExceeded as boolean,
      Segments: trace.Segments?.map((segment) => ({
        Document: JSON.parse(segment?.Document as string) as ParsedDocument,
        Id: segment.Id as string,
      })).sort((a, b) => a.Document.start_time - b.Document.start_time) as ParsedSegment[],
    })).sort((a, b) => a.Segments[0].Document.start_time - b.Segments[0].Document.start_time);

    // Verify that all trace has fully loaded invocation subsegments.
    // The subsegments may be not available yet or still in progress.
    for (const trace of sortedTraces) {
      let retryFlag = false;
      
      let invocationSubsegment;
      try {
        invocationSubsegment = getInvocationSubsegment(trace);
      } catch (error) {
        if (error instanceof FunctionSegmentNotDefinedError){
          retry(new Error(`There is no Function subsegment (AWS::Lambda::Function) yet. Retry.`));
        } else {
          throw error;
        }
      }

      retryFlag = retryFlag || (!!invocationSubsegment.in_progress);
      if (retryFlag) {
        retry(new Error(`There is at least an invocation subsegment that hasn't been fully processed yet. The "in_progress" flag is still "true" in the document.`));
      }
    }

    if (sortedTraces === undefined) {
      throw new Error(`Traces are undefined for ${resourceArn}`);
    }

    if (sortedTraces.length !== expectedTraces) {
      throw new Error(`Expected ${expectedTraces} sorted traces, but got ${sortedTraces.length} for ${resourceArn}`);
    }

    sortedTraces.forEach((trace) => {
      if (trace.Segments?.length != expectedSegments) {
        retry(new Error(`Expected ${expectedSegments} segments, got ${trace.Segments?.length} for trace id ${trace.Id}`));
      }
    });

    return sortedTraces;
  }, retryOptions);
};

const getFunctionSegment = (trace: ParsedTrace): ParsedSegment => {
  const functionSegment = trace.Segments.find((segment) => segment.Document.origin === 'AWS::Lambda::Function');

  if (functionSegment === undefined) {
    throw new FunctionSegmentNotDefinedError('Function segment is undefined. This can be either due to eventual consistency or a bug in Tracer');
  }

  return functionSegment;
};

const getFirstSubsegment = (segment: ParsedDocument): ParsedDocument => {
  const subsegments = segment.subsegments;
  if (!subsegments || subsegments.length == 0) {
    throw new Error('segment should have subsegments');
  }

  return subsegments[0];
};

const getInvocationSubsegment = (trace: ParsedTrace): ParsedDocument => {
  const functionSegment = getFunctionSegment(trace);
  const invocationSubsegment = functionSegment.Document?.subsegments
    ?.find((subsegment) => subsegment.name === 'Invocation');

  if (invocationSubsegment === undefined) {
    throw new Error('Invocation subsegment is undefined');
  }

  return invocationSubsegment;
};

const splitSegmentsByName = (subsegments: ParsedDocument[], expectedNames: string[]): Map<string, ParsedDocument[]> => {
  const splitSegments: Map<string, ParsedDocument[]> = new Map([ ...expectedNames, 'other' ].map(name => [ name, [] ]));
  subsegments.forEach(subsegment => {
    const name = expectedNames.indexOf(subsegment.name) !== -1 ? subsegment.name : 'other';
    const newSegments = splitSegments.get(name) as ParsedDocument[];
    newSegments.push(subsegment);
    splitSegments.set(name, newSegments);
  });
  
  return splitSegments;
};

/**
 * Invoke function sequentially 3 times with different parameters
 * 
 * invocation: is just a tracking number (it has to start from 1)
 * sdkV2: define if we will use `captureAWSClient()` or `captureAWS()` for SDK V2
 * throw: forces the Lambda to throw an error
 * 
 * @param functionName
 */
const invokeAllTestCases = async (functionName: string): Promise<void> => {
  await invokeFunction(functionName, 1, 'SEQUENTIAL', { 
    invocation: 1,
    sdkV2: 'client',
    throw: false,
  });
  await invokeFunction(functionName, 1, 'SEQUENTIAL', { 
    invocation: 2,
    sdkV2: 'all', // only second invocation should use captureAll
    throw: false,
  });
  await invokeFunction(functionName, 1, 'SEQUENTIAL', { 
    invocation: 3,
    sdkV2: 'client', 
    throw: true, // only last invocation should throw
  });
};

const createTracerTestFunction = (params: TracerTestFunctionParams): NodejsFunction => {
  const { stack, functionName, entry, expectedServiceName, environmentParams, runtime } = params;
  const func = new NodejsFunction(stack, functionName, {
    entry: entry,
    functionName: functionName,
    handler: 'handler',
    tracing: Tracing.ACTIVE,
    architecture: Architecture.X86_64,
    memorySize: 256, // Default value (128) will take too long to process
    environment: {
      EXPECTED_SERVICE_NAME: expectedServiceName,
      EXPECTED_CUSTOM_ANNOTATION_KEY: expectedCustomAnnotationKey,
      EXPECTED_CUSTOM_ANNOTATION_VALUE: expectedCustomAnnotationValue,
      EXPECTED_CUSTOM_METADATA_KEY: expectedCustomMetadataKey,
      EXPECTED_CUSTOM_METADATA_VALUE: JSON.stringify(expectedCustomMetadataValue),
      EXPECTED_CUSTOM_RESPONSE_VALUE: JSON.stringify(expectedCustomResponseValue),
      EXPECTED_CUSTOM_ERROR_MESSAGE: expectedCustomErrorMessage,
      ...environmentParams,
    },
    timeout: Duration.seconds(30), // Default value (3 seconds) will time out 
    bundling: { 
      // Exclude aws-sdk and use the default one provided by Lambda
      externalModules: ['aws-sdk'],
    },
    runtime: TEST_RUNTIMES[runtime as TestRuntimesKey],
  });

  return func;
};

let account: string | undefined;
const getFunctionArn = async (functionName: string): Promise<string> => {
  const region = process.env.AWS_REGION;
  const stsClient = new AWS.STS();
  if (!account) {
    const identity = await stsClient.getCallerIdentity().promise();
    account = identity.Account;
  }
  
  return `arn:aws:lambda:${region}:${account}:function:${functionName}`;
};

export {
  getTraces,
  getFunctionSegment,
  getFirstSubsegment,
  getInvocationSubsegment,
  splitSegmentsByName,
  invokeAllTestCases,
  createTracerTestFunction,
  getFunctionArn,
};

export type {
  ParsedDocument,
  TracerTestFunctionParams,
};
