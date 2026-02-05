/**
 * Zod to JSON Schema Converter
 * 
 * Converts Zod schemas to JSON Schema format for AI tool calling.
 * This eliminates the need to maintain duplicate schemas.
 */

import { z } from "zod";

type JsonSchemaType = {
  type?: string;
  enum?: string[];
  properties?: Record<string, JsonSchemaType>;
  items?: JsonSchemaType;
  required?: string[];
  description?: string;
  minimum?: number;
  maximum?: number;
};

/**
 * Convert a Zod schema to JSON Schema format
 */
export function zodToJsonSchema(schema: z.ZodTypeAny): JsonSchemaType {
  return processZodType(schema);
}

function processZodType(schema: z.ZodTypeAny): JsonSchemaType {
  // Unwrap ZodOptional
  if (schema instanceof z.ZodOptional) {
    return processZodType(schema.unwrap());
  }

  // Unwrap ZodNullable
  if (schema instanceof z.ZodNullable) {
    return processZodType(schema.unwrap());
  }

  // Handle ZodObject
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, JsonSchemaType> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = processZodType(value as z.ZodTypeAny);
      
      // Check if field is required (not optional)
      if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodNullable)) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  // Handle ZodArray
  if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: processZodType(schema.element),
    };
  }

  // Handle ZodEnum
  if (schema instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: schema.options,
    };
  }

  // Handle ZodString
  if (schema instanceof z.ZodString) {
    return { type: 'string' };
  }

  // Handle ZodNumber
  if (schema instanceof z.ZodNumber) {
    const result: JsonSchemaType = { type: 'number' };
    // Extract min/max from checks if present
    const checks = (schema as any)._def.checks;
    if (checks) {
      for (const check of checks) {
        if (check.kind === 'min') result.minimum = check.value;
        if (check.kind === 'max') result.maximum = check.value;
      }
    }
    return result;
  }

  // Handle ZodBoolean
  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }

  // Default fallback
  return { type: 'string' };
}

/**
 * Create an AI tool definition from a Zod schema
 */
export function createToolFromSchema(
  name: string,
  description: string,
  schema: z.ZodTypeAny
): { type: string; function: { name: string; description: string; parameters: JsonSchemaType } } {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: zodToJsonSchema(schema),
    },
  };
}
