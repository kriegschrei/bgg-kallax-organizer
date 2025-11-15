import schema from '../../schemas/requests/games/post-payload.schema.json' with { type: 'json' };
import enumsSchema from '../../schemas/$defs/enums.schema.json' with { type: 'json' };
import ajv from './ajvInstance.js';

// Add the enums schema to AJV's registry so it can resolve references
ajv.addSchema(enumsSchema);

const validate = ajv.compile(schema);

const getValueAtPath = (data, instancePath) => {
  if (!instancePath) {
    return data;
  }

  const segments = instancePath
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      if (Number.isInteger(Number(segment))) {
        return Number(segment);
      }
      return segment;
    });

  let current = data;
  for (const segment of segments) {
    if (current == null) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
};

const buildExpectedMessage = (error) => {
  if (!error) return undefined;
  switch (error.keyword) {
    case 'enum':
      if (Array.isArray(error.params?.allowedValues)) {
        return `Expected one of: ${error.params.allowedValues.join(', ')}`;
      }
      return undefined;
    case 'type':
      if (error.params?.type) {
        return `Expected value of type ${error.params.type}.`;
      }
      return undefined;
    case 'required':
      if (error.params?.missingProperty) {
        return `Provide the "${error.params.missingProperty}" property.`;
      }
      return undefined;
    case 'additionalProperties':
      if (error.params?.additionalProperty) {
        return `Remove unsupported property "${error.params.additionalProperty}".`;
      }
      return undefined;
    default:
      return undefined;
  }
};

const formatError = (error, data) => {
  const fieldPath =
    error.instancePath && error.instancePath !== ''
      ? error.instancePath.replace(/\//g, '.').replace(/^\./, '')
      : error.params?.missingProperty || error.params?.additionalProperty || '(root)';

  const receivedValue = getValueAtPath(data, error.instancePath);

  return {
    field: fieldPath,
    message: error.message,
    received: receivedValue,
    expected: buildExpectedMessage(error),
    keyword: error.keyword,
  };
};

export const validateGamesPayload = (payload) => {
  const isValid = validate(payload);
  if (isValid) {
    return { valid: true, errors: [] };
  }

  const errors = (validate.errors || []).map((error) => formatError(error, payload));
  return { valid: false, errors };
};

