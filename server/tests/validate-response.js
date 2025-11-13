import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverRoot = resolve(__dirname, '..');
const projectRoot = resolve(serverRoot, '..');
const responsePath = resolve(projectRoot, 'output', 'games_response.json');
const schemaPath = resolve(serverRoot, 'schemas', 'responses', 'games', 'post-response.schema.json');
const defsDir = resolve(serverRoot, 'schemas', '$defs');
const extraSchemaPaths = [
  resolve(defsDir, 'types.schema.json'),
  resolve(defsDir, 'enums.schema.json'),
];
const schemaAliasMap = {
  [resolve(defsDir, 'types.schema.json')]: '../../$defs/types.schema.json',
  [resolve(defsDir, 'enums.schema.json')]: '../../$defs/enums.schema.json',
};

async function loadJson(path) {
  const contents = await readFile(path, 'utf-8');
  return JSON.parse(contents);
}

async function validate() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const [rawSchema, data, ...additionalSchemas] = await Promise.all([
    loadJson(schemaPath),
    loadJson(responsePath),
    ...extraSchemaPaths.map((path) => loadJson(path)),
  ]);

  const refRewriteMap = {
    '../../$defs/types.schema.json': 'https://example.com/schemas/$defs/types.schema.json',
    '../../$defs/enums.schema.json': 'https://example.com/schemas/$defs/enums.schema.json',
  };

  const schema = structuredClone(rawSchema);

  const rewriteRefs = (value) => {
    if (Array.isArray(value)) {
      value.forEach(rewriteRefs);
      return;
    }
    if (value && typeof value === 'object') {
      if (typeof value.$ref === 'string') {
        for (const [match, replacement] of Object.entries(refRewriteMap)) {
          if (value.$ref.startsWith(match)) {
            value.$ref = value.$ref.replace(match, replacement);
            break;
          }
        }
      }
      Object.values(value).forEach(rewriteRefs);
    }
  };

  rewriteRefs(schema);

  for (let index = 0; index < additionalSchemas.length; index += 1) {
    const schemaPathAtIndex = extraSchemaPaths[index];
    const extraSchema = additionalSchemas[index];
    ajv.addSchema(extraSchema);

    const aliasRefRelative = schemaAliasMap[schemaPathAtIndex];
    if (aliasRefRelative) {
      const aliases = new Set();
      const absoluteBase = new URL(aliasRefRelative, schema.$id).href;
      aliases.add(absoluteBase);
      aliases.add(absoluteBase.replace('$defs', '%24defs'));
      aliases.add(absoluteBase.replace('%24defs', '%2524defs'));
      aliases.add(absoluteBase.replace('$defs', '%2524defs'));

      for (const aliasHref of aliases) {
        ajv.addSchema(
          {
            ...extraSchema,
            $id: aliasHref,
          },
          aliasHref,
        );
      }
    }
  }

  const validateFn = ajv.compile(schema);
  const isValid = validateFn(data);

  if (isValid) {
    console.log('Validation succeeded ✅');
    return;
  }

  console.error('Validation failed ❌');
  for (const error of validateFn.errors ?? []) {
    console.error(`• ${ajv.errorsText([error], { separator: '\n  ' })}`);
  }
  process.exitCode = 1;
}

validate().catch((error) => {
  console.error('Unexpected error during validation:', error);
  process.exitCode = 1;
});


