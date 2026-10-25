/** @type {import('@rtk-query/codegen-openapi').ConfigFile} */
const config = {
  schemaFile: '../dentra-api/openapi.yaml',
  apiFile: './src/api/base-api.ts',
  apiImport: 'baseApi',
  outputFile: './src/api/generated-api.ts',
  exportName: 'dentraApi',
  filterEndpoints: name => name !== 'postVideoWebhook',
  hooks: true,
  tag: true,
};

export default config;
