import { createHash } from 'node:crypto';
import { productionComponentScript } from './component-script.mjs';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const runtimeRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const validateOnly = args.has('--validate-only');
const componentArgIndex = process.argv.indexOf('--component');
const componentDir = componentArgIndex >= 0
  ? resolve(process.cwd(), process.argv[componentArgIndex + 1])
  : join(runtimeRoot, 'section', 'imageText', 'KjbTA8');

const definitionSchemaPath = join(
  runtimeRoot,
  'schema',
  'component-definition.schema.json'
);
const publishSchemaPath = join(
  runtimeRoot,
  'schema',
  'component-publish-package.schema.json'
);

const errors = [];

function fail(message) {
  errors.push(message);
}

async function readText(path) {
  return readFile(path, 'utf8');
}

async function readJson(path) {
  try {
    return JSON.parse(await readText(path));
  } catch (error) {
    throw new Error(`Cannot read JSON ${path}: ${error.message}`);
  }
}

function typeMatches(value, type) {
  switch (type) {
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    case 'integer':
      return Number.isInteger(value);
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'string':
      return typeof value === 'string';
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    default:
      return true;
  }
}

function resolvePointer(document, pointer) {
  if (!pointer.startsWith('#/')) {
    throw new Error(`Only local JSON Schema references are supported: ${pointer}`);
  }

  return pointer
    .slice(2)
    .split('/')
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce((current, part) => current?.[part], document);
}

function validateSchema(value, schema, path, rootSchema, output) {
  if (schema === true || schema === undefined) return;
  if (schema === false) {
    output.push(`${path}: value is not allowed`);
    return;
  }

  if (schema.$ref) {
    const resolved = resolvePointer(rootSchema, schema.$ref);
    if (!resolved) {
      output.push(`${path}: unresolved schema reference ${schema.$ref}`);
      return;
    }
    validateSchema(value, resolved, path, rootSchema, output);
    return;
  }

  if ('const' in schema && !Object.is(value, schema.const)) {
    output.push(`${path}: expected constant ${JSON.stringify(schema.const)}`);
  }

  if (schema.enum && !schema.enum.some((item) => Object.is(item, value))) {
    output.push(`${path}: expected one of ${schema.enum.map(JSON.stringify).join(', ')}`);
  }

  if (schema.oneOf) {
    const matches = schema.oneOf.filter((candidate) => {
      const candidateErrors = [];
      validateSchema(value, candidate, path, rootSchema, candidateErrors);
      return candidateErrors.length === 0;
    });
    if (matches.length !== 1) {
      output.push(`${path}: expected exactly one matching schema, got ${matches.length}`);
    }
    return;
  }

  if (schema.type) {
    const accepted = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!accepted.some((type) => typeMatches(value, type))) {
      output.push(`${path}: expected ${accepted.join('|')}, got ${Array.isArray(value) ? 'array' : typeof value}`);
      return;
    }
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      output.push(`${path}: string is shorter than ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      output.push(`${path}: string is longer than ${schema.maxLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      output.push(`${path}: does not match ${schema.pattern}`);
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      output.push(`${path}: must be >= ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      output.push(`${path}: must be <= ${schema.maximum}`);
    }
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      output.push(`${path}: must be > ${schema.exclusiveMinimum}`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      output.push(`${path}: expected at least ${schema.minItems} items`);
    }
    if (schema.uniqueItems) {
      const serialized = value.map((item) => JSON.stringify(item));
      if (new Set(serialized).size !== serialized.length) {
        output.push(`${path}: items must be unique`);
      }
    }
    if (schema.items) {
      value.forEach((item, index) => {
        validateSchema(item, schema.items, `${path}[${index}]`, rootSchema, output);
      });
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    if (schema.minProperties !== undefined && Object.keys(value).length < schema.minProperties) {
      output.push(`${path}: expected at least ${schema.minProperties} properties`);
    }

    for (const required of schema.required ?? []) {
      if (!(required in value)) {
        output.push(`${path}.${required}: required property is missing`);
      }
    }

    for (const [key, child] of Object.entries(value)) {
      if (schema.properties?.[key]) {
        validateSchema(child, schema.properties[key], `${path}.${key}`, rootSchema, output);
        continue;
      }

      if (schema.additionalProperties === false) {
        output.push(`${path}.${key}: additional property is not allowed`);
      } else if (typeof schema.additionalProperties === 'object') {
        validateSchema(
          child,
          schema.additionalProperties,
          `${path}.${key}`,
          rootSchema,
          output
        );
      }
    }
  }
}

async function expandGroups(manifest) {
  const expanded = [];

  for (const group of manifest.editor.groups) {
    if (!group.$include) {
      expanded.push(group);
      continue;
    }

    const includePath = join(
      runtimeRoot,
      'shared',
      'groups',
      `${group.$include}.json`
    );
    expanded.push(await readJson(includePath));
  }

  return expanded;
}

function validateElements(groups, definitionSchema) {
  const fields = new Map();
  const groupIds = new Set();
  const cssVariables = new Set();

  groups.forEach((group, groupIndex) => {
    const groupPath = `groups[${groupIndex}]`;
    const groupErrors = [];
    validateSchema(
      group,
      { $ref: '#/$defs/group' },
      groupPath,
      definitionSchema,
      groupErrors
    );
    errors.push(...groupErrors);

    if (groupIds.has(group.id)) fail(`${groupPath}.id: duplicate group ${group.id}`);
    groupIds.add(group.id);

    group.elements.forEach((element, elementIndex) => {
      const elementPath = `${groupPath}.elements[${elementIndex}]`;

      if (element.type === 'divider') {
        if (element.field) fail(`${elementPath}: divider must not define field`);
        return;
      }

      if (!element.field) fail(`${elementPath}.field: required for ${element.type}`);
      if (!('default' in element)) fail(`${elementPath}.default: required for ${element.type}`);
      if (!element.name) fail(`${elementPath}.name: required for ${element.type}`);

      if (element.field && fields.has(element.field)) {
        fail(`${elementPath}.field: duplicate field ${element.field}`);
      }
      fields.set(element.field, element);

      if (element.cssVariable) {
        if (cssVariables.has(element.cssVariable)) {
          fail(`${elementPath}.cssVariable: duplicate ${element.cssVariable}`);
        }
        cssVariables.add(element.cssVariable);
      }

      if (['select', 'radio'].includes(element.type)) {
        if (!element.options?.length) {
          fail(`${elementPath}.options: ${element.type} requires options`);
        } else if (!element.options.some((option) => Object.is(option.value, element.default))) {
          fail(`${elementPath}.default: value is not present in options`);
        }
      }

      if (element.type === 'slider') {
        if (typeof element.default !== 'number') {
          fail(`${elementPath}.default: slider default must be a number`);
        }
        if (element.min !== undefined && element.default < element.min) {
          fail(`${elementPath}.default: value is below min`);
        }
        if (element.max !== undefined && element.default > element.max) {
          fail(`${elementPath}.default: value is above max`);
        }
      }

      const expectedType = {
        switch: 'boolean',
        text: 'string',
        textarea: 'string',
        richText: 'string',
        colorPicker: 'string',
        imagePicker: 'string',
        linkPicker: 'string'
      }[element.type];

      if (expectedType && typeof element.default !== expectedType) {
        fail(`${elementPath}.default: expected ${expectedType}`);
      }
    });
  });

  return fields;
}

function createDefaults(fields) {
  return Object.fromEntries(
    [...fields.entries()].map(([field, element]) => [field, element.default])
  );
}

function validateSettingValue(value, element, path) {
  if (['select', 'radio'].includes(element.type)) {
    if (!element.options.some((option) => Object.is(option.value, value))) {
      fail(`${path}: value ${JSON.stringify(value)} is not in options`);
    }
    return;
  }

  const expectedType = {
    switch: 'boolean',
    slider: 'number',
    text: 'string',
    textarea: 'string',
    richText: 'string',
    colorPicker: 'string',
    imagePicker: 'string',
    linkPicker: 'string'
  }[element.type];

  if (expectedType && typeof value !== expectedType) {
    fail(`${path}: expected ${expectedType}, got ${typeof value}`);
  }
}

function validateTemplateReferences(template, fields, dataContract) {
  const settingReferences = new Set(
    [...template.matchAll(/section\.settings\.([A-Za-z][A-Za-z0-9]*)/g)]
      .map((match) => match[1])
  );

  for (const field of settingReferences) {
    if (!fields.has(field)) {
      fail(`template: unknown setting field section.settings.${field}`);
    }
  }

  const dataReferences = new Set(
    [...template.matchAll(/section\.data\.([A-Za-z][A-Za-z0-9]*)/g)]
      .map((match) => match[1])
  );
  const contractFields = new Set(Object.keys(dataContract.properties ?? {}));

  for (const field of dataReferences) {
    if (!contractFields.has(field)) {
      fail(`template: unknown data field section.data.${field}`);
    }
  }
}

async function validateFixtures(manifest, fields, dataContract) {
  const fixtureDir = join(componentDir, 'fixtures');
  const fixtureNames = (await readdir(fixtureDir))
    .filter((name) => name.endsWith('.json'))
    .sort();

  if (!fixtureNames.length) {
    fail('fixtures: at least one JSON fixture is required');
    return [];
  }

  const fixtures = [];

  for (const name of fixtureNames) {
    const path = join(fixtureDir, name);
    const fixture = await readJson(path);
    const prefix = `fixtures/${name}`;
    fixtures.push({ name, fixture });

    if (!fixture.section) {
      fail(`${prefix}.section: required`);
      continue;
    }
    if (fixture.section.type !== manifest.type) {
      fail(`${prefix}.section.type: expected ${manifest.type}`);
    }
    if (fixture.section.templateId !== manifest.templateId) {
      fail(`${prefix}.section.templateId: expected ${manifest.templateId}`);
    }

    for (const [field, value] of Object.entries(fixture.section.settings ?? {})) {
      const element = fields.get(field);
      if (!element) {
        fail(`${prefix}.section.settings.${field}: unknown setting`);
        continue;
      }
      validateSettingValue(value, element, `${prefix}.section.settings.${field}`);
    }

    const contractErrors = [];
    validateSchema(
      fixture.section.data,
      dataContract,
      `${prefix}.section.data`,
      dataContract,
      contractErrors
    );
    errors.push(...contractErrors);
  }

  return fixtures;
}

function checkScript(scriptPath) {
  const result = spawnSync(process.execPath, ['--check', scriptPath], {
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    fail(`script syntax: ${result.stderr.trim()}`);
  }
}

async function compileScss(stylePath, outputPath) {
  const result = spawnSync(
    'sass',
    [stylePath, outputPath, '--style=compressed', '--no-source-map', '--no-charset'],
    { encoding: 'utf8' }
  );

  if (result.error?.code === 'ENOENT') {
    fail('style: sass executable was not found');
    return;
  }
  if (result.status !== 0) {
    fail(`style compile: ${result.stderr.trim()}`);
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }

  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function sha256Named(parts) {
  const hash = createHash('sha256');
  parts.forEach(([name, content]) => {
    const bytes = Buffer.from(content, 'utf8');
    hash.update(name, 'utf8');
    hash.update('\0', 'utf8');
    hash.update(String(bytes.byteLength), 'ascii');
    hash.update('\0', 'utf8');
    hash.update(bytes);
  });
  return hash.digest('hex');
}

async function validateChecksumGolden() {
  const golden = await readJson(join(runtimeRoot, 'contracts', 'checksum-golden.json'));
  const actual = `sha256:${sha256Named(
    golden.parts.map(({ name, content }) => [name, content])
  )}`;
  if (actual !== golden.checksum) {
    fail(`checksum golden: expected ${golden.checksum}, got ${actual}`);
  }
}

async function main() {
  const manifestPath = join(componentDir, 'manifest.json');
  const manifest = await readJson(manifestPath);
  const definitionSchema = await readJson(definitionSchemaPath);
  const publishSchema = await readJson(publishSchemaPath);
  await validateChecksumGolden();

  const manifestErrors = [];
  validateSchema(manifest, definitionSchema, 'manifest', definitionSchema, manifestErrors);
  errors.push(...manifestErrors);

  const groups = await expandGroups(manifest);
  const fields = validateElements(groups, definitionSchema);
  const defaults = createDefaults(fields);

  for (const field of manifest.i18n?.rootFields ?? []) {
    const element = fields.get(field);
    if (!element) {
      fail(`i18n.rootFields: unknown field ${field}`);
    } else if (!element.translatable) {
      fail(`i18n.rootFields: ${field} is not marked translatable`);
    }
  }

  const dataContract = manifest.data?.contract
    ? await readJson(join(
      runtimeRoot,
      'contracts',
      `${manifest.data.contract}.schema.json`
    ))
    : {
      type: 'object',
      additionalProperties: false,
      properties: {}
    };

  const templatePath = join(componentDir, manifest.render.template);
  const stylePath = join(componentDir, manifest.render.style);
  const scriptPath = join(componentDir, manifest.render.script);
  const foundationStylePath = join(runtimeRoot, 'css', 'base.scss');
  const storefrontRuntimePath = join(runtimeRoot, 'js', 'base.js');
  const variableStylePath = manifest.render.variableStyle
    ? join(componentDir, manifest.render.variableStyle)
    : null;

  const template = await readText(templatePath);
  const script = productionComponentScript(await readText(scriptPath));
  const variableStyle = variableStylePath ? await readText(variableStylePath) : '';

  validateTemplateReferences(template + variableStyle, fields, dataContract);
  checkScript(scriptPath);
  checkScript(storefrontRuntimePath);
  await validateFixtures(manifest, fields, dataContract);

  const temporaryDir = await mkdtemp(join(tmpdir(), 'oga-theme-v2-'));
  const temporaryCss = join(temporaryDir, 'section.css');
  const temporaryFrameworkCss = join(temporaryDir, 'framework.css');

  try {
    await compileScss(stylePath, temporaryCss);
    await compileScss(foundationStylePath, temporaryFrameworkCss);

    if (errors.length) {
      throw new Error(`Validation failed:\n- ${errors.join('\n- ')}`);
    }

    const css = await readText(temporaryCss);
    const frameworkCss = await readText(temporaryFrameworkCss);
    const storefrontRuntime = await readText(storefrontRuntimePath);
    const expandedManifest = {
      ...manifest,
      editor: { groups }
    };
    delete expandedManifest.$schema;

    const checksum = sha256Named([
      ['definition.json', canonicalJson(expandedManifest)],
      ['defaults.json', canonicalJson(defaults)],
      ['section.th.html', template],
      ['section.css', css],
      ['variable.th.css', variableStyle],
      ['section.js', script]
    ]);

    const publish = {
      packageVersion: 1,
      identity: {
        protocolVersion: manifest.protocolVersion,
        componentKind: manifest.componentKind,
        type: manifest.type,
        templateId: manifest.templateId,
        runtimeVersion: manifest.runtimeVersion,
        definitionVersion: manifest.definitionVersion,
        schemaVersion: manifest.schemaVersion
      },
      checksum: `sha256:${checksum}`,
      definition: expandedManifest,
      defaults,
      assets: {
        thymeleafTemplate: template,
        baseCss: css,
        variableCss: variableStyle,
        script
      }
    };

    const publishErrors = [];
    validateSchema(publish, publishSchema, 'publish', publishSchema, publishErrors);
    if (publishErrors.length) {
      throw new Error(`Publish package validation failed:\n- ${publishErrors.join('\n- ')}`);
    }

    if (validateOnly) {
      console.log(`Valid: ${manifest.type}/${manifest.templateId}@${manifest.definitionVersion}`);
      return;
    }

    const outputDir = join(
      runtimeRoot,
      'dist',
      manifest.type,
      manifest.templateId,
      String(manifest.definitionVersion)
    );
    await mkdir(outputDir, { recursive: true });

    await writeFile(
      join(outputDir, 'manifest.expanded.json'),
      `${JSON.stringify(expandedManifest, null, 2)}\n`
    );
    await writeFile(
      join(outputDir, 'defaults.json'),
      `${JSON.stringify(defaults, null, 2)}\n`
    );
    await cp(templatePath, join(outputDir, 'section.java'));
    await writeFile(join(outputDir, 'section.js'), script);
    await cp(temporaryCss, join(outputDir, 'section.css'));
    if (variableStylePath) {
      await cp(variableStylePath, join(outputDir, 'variable.java'));
    }

    await writeFile(
      join(outputDir, 'publish.json'),
      `${JSON.stringify(publish, null, 2)}\n`
    );

    const runtimeOutputDir = join(runtimeRoot, 'dist', 'runtime-v2');
    const runtimeChecksum = sha256Named([
      ['framework.css', frameworkCss],
      ['storefront.js', storefrontRuntime]
    ]);
    await mkdir(runtimeOutputDir, { recursive: true });
    await writeFile(join(runtimeOutputDir, 'framework.css'), frameworkCss);
    await cp(storefrontRuntimePath, join(runtimeOutputDir, 'storefront.js'));
    await writeFile(
      join(runtimeOutputDir, 'runtime-manifest.json'),
      `${JSON.stringify({
        runtimeVersion: 2,
        checksum: `sha256:${runtimeChecksum}`,
        assets: {
          frameworkCss: 'framework.css',
          storefrontScript: 'storefront.js'
        }
      }, null, 2)}\n`
    );

    console.log(`Built: ${outputDir}`);
    console.log(`Checksum: sha256:${checksum}`);
    console.log(`Runtime: ${runtimeOutputDir}`);
    console.log(`Runtime checksum: sha256:${runtimeChecksum}`);
  } finally {
    await rm(temporaryDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
