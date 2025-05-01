/**
 * Error Handling System
 * 
 * Provides standardized error handling for the application, including:
 * - Custom error types with appropriate HTTP status codes
 * - Error formatting for GraphQL responses
 * - Structured logging with correlation IDs
 * - Retryable errors with backoff strategies
 */

import { GraphQLError, GraphQLFormattedError } from 'graphql';
import { captureException } from '../monitoring';

// Function to generate a random ID for correlation
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * Error codes used to categorize errors throughout the application
 */
export enum ErrorCode {
  // Client errors (400-499)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Server errors (500-599)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  BLOCKCHAIN_ERROR = 'BLOCKCHAIN_ERROR',
  
  // Special cases
  TRANSIENT_ERROR = 'TRANSIENT_ERROR', // Temporary error that can be retried
  PERMANENT_ERROR = 'PERMANENT_ERROR', // Error that should not be retried
}

/**
 * Mapping of error codes to HTTP status codes
 */
export const HTTP_STATUS_CODES: Record<ErrorCode, number> = {
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.VALIDATION_ERROR]: 422,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.CACHE_ERROR]: 500,
  [ErrorCode.BLOCKCHAIN_ERROR]: 500,
  [ErrorCode.TRANSIENT_ERROR]: 503,
  [ErrorCode.PERMANENT_ERROR]: 500,
};

// Interface for the constructor options
export interface ErrorOptions {
  message: string;
  code: ErrorCode;
  path?: string[];
  metadata?: Record<string, any>;
  correlationId?: string;
  isRetryable?: boolean;
  cause?: Error;
}

/**
 * Base error class for application-specific errors
 */
export class ApplicationError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly correlationId: string;
  public readonly path?: string[];
  public readonly metadata?: Record<string, any>;
  public readonly timestamp: Date;
  public readonly isRetryable: boolean;
  public readonly cause?: Error;
  
  constructor(options: ErrorOptions) {
    super(options.message);
    
    // Set error name to the class name for better stack traces
    this.name = this.constructor.name;
    
    // Set the error code and corresponding HTTP status
    this.code = options.code;
    this.httpStatus = HTTP_STATUS_CODES[options.code] || 500;
    
    // Set additional error properties
    this.path = options.path;
    this.metadata = options.metadata;
    this.correlationId = options.correlationId || generateId();
    this.timestamp = new Date();
    this.isRetryable = options.isRetryable ?? 
      (this.code === ErrorCode.TRANSIENT_ERROR ||
       this.code === ErrorCode.SERVICE_UNAVAILABLE ||
       this.code === ErrorCode.DATABASE_ERROR);
    
    // Capture the cause for better debugging
    if (options.cause) {
      this.cause = options.cause;
    }
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
  
  /**
   * Format the error for GraphQL responses
   */
  toGraphQLError(): GraphQLError {
    return new GraphQLError(
      this.message,
      {
        extensions: {
          code: this.code,
          httpStatus: this.httpStatus,
          correlationId: this.correlationId,
          timestamp: this.timestamp.toISOString(),
          ...(this.metadata && { metadata: this.metadata }),
        },
        path: this.path,
      }
    );
  }
  
  /**
   * Log the error with appropriate severity
   */
  log(additionalContext: Record<string, any> = {}): void {
    const errorContext = {
      errorName: this.name,
      errorCode: this.code,
      httpStatus: this.httpStatus,
      correlationId: this.correlationId,
      timestamp: this.timestamp.toISOString(),
      message: this.message,
      stack: this.stack,
      isRetryable: this.isRetryable,
      ...additionalContext,
      ...(this.metadata && { metadata: this.metadata }),
    };
    
    // Log based on error severity (higher HTTP status codes are more severe)
    if (this.httpStatus >= 500) {
      console.error('Server error:', errorContext);
      captureException(this, errorContext);
    } else if (this.httpStatus >= 400) {
      console.warn('Client error:', errorContext);
    } else {
      console.info('Info error:', errorContext);
    }
  }
}

// Type for derived error class constructors
type ErrorConstructorOptions = Omit<ErrorOptions, 'code'>;

/**
 * Specialized error classes for common error types
 */

// Client errors
export class BadRequestError extends ApplicationError {
  constructor(message: string, options: Partial<ErrorConstructorOptions> = {}) {
    super({
      message,
      code: ErrorCode.BAD_REQUEST,
      isRetryable: false,
      ...options,
    });
  }
}

export class UnauthorizedError extends ApplicationError {
  constructor(message: string, options: Partial<ErrorConstructorOptions> = {}) {
    super({
      message,
      code: ErrorCode.UNAUTHORIZED,
      isRetryable: false,
      ...options,
    });
  }
}

export class ForbiddenError extends ApplicationError {
  constructor(message: string, options: Partial<ErrorConstructorOptions> = {}) {
    super({
      message,
      code: ErrorCode.FORBIDDEN,
      isRetryable: false,
      ...options,
    });
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message: string, options: Partial<ErrorConstructorOptions> = {}) {
    super({
      message,
      code: ErrorCode.NOT_FOUND,
      isRetryable: false,
      ...options,
    });
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string, options: Partial<ErrorConstructorOptions> = {}) {
    super({
      message,
      code: ErrorCode.VALIDATION_ERROR,
      isRetryable: false,
      ...options,
    });
  }
}

export class RateLimitExceededError extends ApplicationError {
  constructor(message: string, options: Partial<ErrorConstructorOptions> = {}) {
    super({
      message,
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      isRetryable: true, // Rate limits are temporary
      ...options,
    });
  }
}

// Server errors
export class InternalServerError extends ApplicationError {
  constructor(message: string, options: Partial<ErrorConstructorOptions> = {}) {
    super({
      message,
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      isRetryable: false,
      ...options,
    });
  }
}

export class ServiceUnavailableError extends ApplicationError {
  constructor(message: string, options: Partial<ErrorConstructorOptions> = {}) {
    super({
      message,
      code: ErrorCode.SERVICE_UNAVAILABLE,
      isRetryable: true,
      ...options,
    });
  }
}

export class DatabaseError extends ApplicationError {
  constructor(message: string, options: Partial<ErrorConstructorOptions> = {}) {
    super({
      message,
      code: ErrorCode.DATABASE_ERROR,
      isRetryable: true, // Database errors can often be retried
      ...options,
    });
  }
}

export class CacheError extends ApplicationError {
  constructor(message: string, options: Partial<ErrorConstructorOptions> = {}) {
    super({
      message,
      code: ErrorCode.CACHE_ERROR,
      isRetryable: true, // Cache errors can often be retried
      ...options,
    });
  }
}

export class BlockchainError extends ApplicationError {
  constructor(message: string, options: Partial<ErrorConstructorOptions> = {}) {
    super({
      message,
      code: ErrorCode.BLOCKCHAIN_ERROR,
      isRetryable: true, // Blockchain errors can often be retried
      ...options,
    });
  }
}

/**
 * Format GraphQL errors for client responses
 */
export function formatGraphQLError(error: GraphQLError): GraphQLFormattedError {
  const originalError = error.originalError;
  
  // If it's our own ApplicationError, use its formatting
  if (originalError instanceof ApplicationError) {
    const graphqlError = originalError.toGraphQLError();
    
    // Log the error
    originalError.log();
    
    // Return a properly formatted error
    return {
      message: graphqlError.message,
      locations: graphqlError.locations,
      path: graphqlError.path,
      extensions: graphqlError.extensions,
    };
  }
  
  // Default error formatting for other errors
  const correlationId = generateId();
  
  // Log unknown errors
  console.error('Unhandled GraphQL error:', {
    message: error.message,
    locations: error.locations,
    path: error.path,
    stack: error.extensions?.stack || originalError?.stack,
    correlationId,
  });
  
  // Capture in monitoring system
  captureException(originalError || error, {
    correlationId,
    graphqlPath: error.path,
  });
  
  // Return sanitized error for client
  return {
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : error.message,
    extensions: {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      correlationId,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Create a retry function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffFactor?: number;
    shouldRetry?: (error: Error) => boolean;
    onRetry?: (error: Error, attempt: number, delayMs: number) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 100,
    maxDelayMs = 5000,
    backoffFactor = 2,
    shouldRetry = (error) => error instanceof ApplicationError && error.isRetryable,
    onRetry = (error, attempt, delayMs) => {
      console.log(`Retrying after error (attempt ${attempt}/${maxRetries}) in ${delayMs}ms:`, error.message);
    },
  } = options;
  
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if we should retry
      if (attempt > maxRetries || !shouldRetry(lastError)) {
        throw lastError;
      }
      
      // Calculate delay with exponential backoff
      const delayMs = Math.min(
        initialDelayMs * Math.pow(backoffFactor, attempt - 1),
        maxDelayMs
      );
      
      // Add some jitter to prevent thundering herd
      const jitteredDelayMs = delayMs * (0.8 + Math.random() * 0.4);
      
      // Call the onRetry callback
      onRetry(lastError, attempt, Math.round(jitteredDelayMs));
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, jitteredDelayMs));
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw lastError!;
} 