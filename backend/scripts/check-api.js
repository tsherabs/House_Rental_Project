import SwaggerParser from '@apidevtools/swagger-parser';
import { fileURLToPath } from 'node:url';
const api = await SwaggerParser.validate(fileURLToPath(new URL('../../docs/api.yaml', import.meta.url)));
const operations = Object.values(api.paths).flatMap((path) => Object.keys(path).filter((key) => ['get','post','patch','delete'].includes(key)));
console.log(`OpenAPI ${api.openapi}: ${operations.length} operations validated`);
