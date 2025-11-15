import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import addErrors from 'ajv-errors';

const ajv = new Ajv({
  allErrors: true,
  allowUnionTypes: true,
  strict: false,
  useDefaults: true,
});

addFormats(ajv);
addErrors(ajv);

export default ajv;

