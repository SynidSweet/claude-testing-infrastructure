import { Template, TemplateContext } from '../TestTemplateEngine';
import { TestType } from '../../TestGenerator';

/**
 * Jest Express API template for testing Express.js routes and middleware
 */
export class JestExpressApiTemplate implements Template {
  name = 'jest-express-api';
  language = 'javascript' as const;
  framework = 'express';
  testType = TestType.API;

  generate(context: TemplateContext): string {
    const { moduleName, exports, moduleSystem } = context;
    const useESM = moduleSystem === 'esm';

    const templateContent = `${useESM ? "import request from 'supertest';\nimport express from 'express';\nimport { " + exports.join(', ') + " } from './" + moduleName + ".js';" : "const request = require('supertest');\nconst express = require('express');\nconst { " + exports.join(', ') + " } = require('./" + moduleName + "');"}

const app = express();
app.use(express.json());

describe('${moduleName} API', () => {
  beforeEach(() => {
    // Setup test database or mock services
  });

  afterEach(() => {
    // Cleanup
  });

${exports
  .map(
    (exportName) => `
  describe('${exportName}', () => {
    it('should handle successful requests', async () => {
      const response = await request(app)
        .get('/api/test') // TODO: Update with actual endpoint
        .expect(200);
        
      expect(response.body).toBeDefined();
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/test') // TODO: Update with actual endpoint
        .send({}) // Invalid data
        .expect(400);
        
      expect(response.body.error).toBeDefined();
    });

    it('should handle authentication', async () => {
      // Test unauthorized access
      const unauthorizedResponse = await request(app)
        .get('/api/test')
        .expect(401);
      
      expect(unauthorizedResponse.body).toHaveProperty('error');
      expect(unauthorizedResponse.body.error).toMatch(/unauthorized|authentication/i);
      
      // Test with valid token/credentials
      const authorizedResponse = await request(app)
        .get('/api/test')
        .set('Authorization', 'Bearer test-token') // Update with actual auth method
        .expect(200);
      
      expect(authorizedResponse.body).toBeDefined();
    });
  });
`
  )
  .join('')}
});
`;

    return templateContent;
  }
}
