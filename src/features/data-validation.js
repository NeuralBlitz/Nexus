import { EventEmitter } from 'events';

export class ValidationRule {
  constructor(name, validator, message) {
    this.name = name;
    this.validator = validator;
    this.message = message;
  }

  validate(value) {
    try {
      const result = this.validator(value);
      return { valid: true, value: result };
    } catch (error) {
      return { valid: false, error: this.message || error.message };
    }
  }
}

export class ValidationSchema {
  constructor(name) {
    this.name = name;
    this.fields = new Map();
  }

  field(name, type, rules = {}) {
    this.fields.set(name, { type, rules });
    return this;
  }

  string(name, rules = {}) {
    return this.field(name, 'string', {
      required: rules.required,
      minLength: rules.minLength,
      maxLength: rules.maxLength,
      pattern: rules.pattern,
      enum: rules.enum
    });
  }

  number(name, rules = {}) {
    return this.field(name, 'number', {
      required: rules.required,
      min: rules.min,
      max: rules.max,
      integer: rules.integer
    });
  }

  boolean(name, rules = {}) {
    return this.field(name, 'boolean', { required: rules.required });
  }

  array(name, rules = {}) {
    return this.field(name, 'array', {
      required: rules.required,
      minItems: rules.minItems,
      maxItems: rules.maxItems,
      items: rules.items
    });
  }

  object(name, rules = {}) {
    return this.field(name, 'object', { required: rules.required, schema: rules.schema });
  }

  email(name, rules = {}) {
    return this.string(name, {
      ...rules,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    });
  }

  url(name, rules = {}) {
    return this.string(name, {
      ...rules,
      pattern: /^https?:\/\/.+/
    });
  }

  validate(data) {
    const errors = [];
    const validated = {};

    for (const [fieldName, fieldDef] of this.fields) {
      const value = data[fieldName];
      const fieldErrors = [];

      if (value === undefined || value === null) {
        if (fieldDef.rules?.required) {
          fieldErrors.push(`${fieldName} is required`);
        }
        continue;
      }

      if (fieldDef.type === 'string') {
        if (typeof value !== 'string') {
          fieldErrors.push(`${fieldName} must be a string`);
        } else {
          const { minLength, maxLength, pattern, enum: enumVals } = fieldDef.rules;
          if (minLength && value.length < minLength) {
            fieldErrors.push(`${fieldName} must be at least ${minLength} characters`);
          }
          if (maxLength && value.length > maxLength) {
            fieldErrors.push(`${fieldName} must be at most ${maxLength} characters`);
          }
          if (pattern && !pattern.test(value)) {
            fieldErrors.push(`${fieldName} has an invalid format`);
          }
          if (enumVals && !enumVals.includes(value)) {
            fieldErrors.push(`${fieldName} must be one of: ${enumVals.join(', ')}`);
          }
        }
      }

      if (fieldDef.type === 'number') {
        if (typeof value !== 'number' || isNaN(value)) {
          fieldErrors.push(`${fieldName} must be a number`);
        } else {
          const { min, max, integer } = fieldDef.rules;
          if (integer && !Number.isInteger(value)) {
            fieldErrors.push(`${fieldName} must be an integer`);
          }
          if (min !== undefined && value < min) {
            fieldErrors.push(`${fieldName} must be at least ${min}`);
          }
          if (max !== undefined && value > max) {
            fieldErrors.push(`${fieldName} must be at most ${max}`);
          }
        }
      }

      if (fieldDef.type === 'boolean') {
        if (typeof value !== 'boolean') {
          fieldErrors.push(`${fieldName} must be a boolean`);
        }
      }

      if (fieldDef.type === 'array') {
        if (!Array.isArray(value)) {
          fieldErrors.push(`${fieldName} must be an array`);
        } else {
          const { minItems, maxItems } = fieldDef.rules;
          if (minItems && value.length < minItems) {
            fieldErrors.push(`${fieldName} must have at least ${minItems} items`);
          }
          if (maxItems && value.length > maxItems) {
            fieldErrors.push(`${fieldName} must have at most ${maxItems} items`);
          }
        }
      }

      if (fieldDef.type === 'object') {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          fieldErrors.push(`${fieldName} must be an object`);
        } else if (fieldDef.rules?.schema) {
          const subResult = fieldDef.rules.schema.validate(value);
          if (!subResult.valid) {
            fieldErrors.push(...subResult.errors.map(e => `${fieldName}.${e}`));
          }
        }
      }

      if (fieldErrors.length > 0) {
        errors.push(...fieldErrors);
      } else {
        validated[fieldName] = value;
      }
    }

    return { valid: errors.length === 0, errors, data: validated };
  }
}

export class SchemaBuilder {
  constructor() {
    this.schemas = new Map();
  }

  create(name, definition) {
    const schema = new ValidationSchema(name);

    for (const [field, config] of Object.entries(definition)) {
      const { type, ...rules } = config;
      schema.field(field, type, rules);
    }

    this.schemas.set(name, schema);
    return schema;
  }

  get(name) {
    return this.schemas.get(name);
  }

  validate(name, data) {
    const schema = this.schemas.get(name);
    if (!schema) {
      throw new Error(`Schema not found: ${name}`);
    }
    return schema.validate(data);
  }
}

export class DataNormalizer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.rules = new Map();
    this.registerDefaultRules();
  }

  registerDefaultRules() {
    this.registerRule('trim', (value) => typeof value === 'string' ? value.trim() : value);
    this.registerRule('lowercase', (value) => typeof value === 'string' ? value.toLowerCase() : value);
    this.registerRule('uppercase', (value) => typeof value === 'string' ? value.toUpperCase() : value);
    this.registerRule('capitalize', (value) => {
      if (typeof value !== 'string') return value;
      return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
    });
    this.registerRule('stripHtml', (value) => typeof value === 'string' ? value.replace(/<[^>]*>/g, '') : value);
    this.registerRule('toNumber', (value) => {
      const num = Number(value);
      return isNaN(num) ? value : num;
    });
    this.registerRule('toBoolean', (value) => {
      if (value === 'true' || value === true) return true;
      if (value === 'false' || value === false) return false;
      return value;
    });
  }

  registerRule(name, fn) {
    this.rules.set(name, fn);
  }

  normalize(data, ruleNames = []) {
    const normalized = { ...data };

    for (const ruleName of ruleNames) {
      const rule = this.rules.get(ruleName);
      if (rule) {
        for (const [key, value] of Object.entries(normalized)) {
          normalized[key] = rule(value);
        }
      }
    }

    return normalized;
  }

  sanitize(data, fields, rules) {
    const sanitized = { ...data };

    for (const [field, fieldRules] of Object.entries(fields)) {
      if (sanitized[field] !== undefined) {
        for (const ruleName of fieldRules) {
          const rule = this.rules.get(ruleName);
          if (rule) {
            sanitized[field] = rule(sanitized[field]);
          }
        }
      }
    }

    return sanitized;
  }
}

let schemaBuilder = null;

export function getSchemaBuilder() {
  if (!schemaBuilder) {
    schemaBuilder = new SchemaBuilder();
  }
  return schemaBuilder;
}

export default { ValidationSchema, ValidationRule, SchemaBuilder, DataNormalizer, getSchemaBuilder };
