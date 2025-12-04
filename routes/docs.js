import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import yaml from 'yaml';

const r = Router();
const file = fs.readFileSync('./openapi/openapi.yaml', 'utf8');
const spec = yaml.parse(file);
r.use('/docs/api', swaggerUi.serve, swaggerUi.setup(spec));
export default r;
