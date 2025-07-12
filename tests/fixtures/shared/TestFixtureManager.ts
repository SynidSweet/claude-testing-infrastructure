import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export interface ProjectFixture {
  id: string;
  name: string;
  description: string;
  path: string;
  template: ProjectTemplate;
  cached: boolean;
}

export interface ProjectTemplate {
  type: 'node-js' | 'react' | 'python' | 'mcp-server' | 'mixed' | 'empty';
  framework?: string;
  packageManager?: 'npm' | 'yarn' | 'pnpm';
  files: Record<string, string | object>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export class TestFixtureManager {
  private static instance: TestFixtureManager;
  private fixtureCache = new Map<string, ProjectFixture>();
  private tempBaseDir: string | null = null;

  static getInstance(): TestFixtureManager {
    if (!TestFixtureManager.instance) {
      TestFixtureManager.instance = new TestFixtureManager();
    }
    return TestFixtureManager.instance;
  }

  private constructor() {}

  async initialize(): Promise<void> {
    if (!this.tempBaseDir) {
      this.tempBaseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-testing-fixtures-'));
    }
  }

  async cleanup(): Promise<void> {
    if (this.tempBaseDir) {
      try {
        await fs.rm(this.tempBaseDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
      this.tempBaseDir = null;
    }
    this.fixtureCache.clear();
  }

  async getFixture(templateId: string): Promise<ProjectFixture> {
    await this.initialize();

    if (this.fixtureCache.has(templateId)) {
      return this.fixtureCache.get(templateId)!;
    }

    const template = this.getTemplate(templateId);
    const fixturePath = path.join(this.tempBaseDir!, `fixture-${templateId}-${Date.now()}`);
    
    await this.createProjectFromTemplate(fixturePath, template);

    const fixture: ProjectFixture = {
      id: templateId,
      name: template.type,
      description: `Test fixture for ${template.type} project`,
      path: fixturePath,
      template,
      cached: true
    };

    this.fixtureCache.set(templateId, fixture);
    return fixture;
  }

  async createTemporaryProject(templateId: string): Promise<string> {
    const fixture = await this.getFixture(templateId);
    const tempPath = await fs.mkdtemp(path.join(os.tmpdir(), `test-project-${templateId}-`));
    
    // Copy fixture to temporary location for isolation
    await this.copyDirectory(fixture.path, tempPath);
    return tempPath;
  }

  private getTemplate(templateId: string): ProjectTemplate {
    const templates: Record<string, ProjectTemplate> = {
      'empty': {
        type: 'empty',
        files: {}
      },
      
      'node-js-basic': {
        type: 'node-js',
        packageManager: 'npm',
        files: {
          'package.json': {
            name: 'test-node-project',
            version: '1.0.0',
            main: 'index.js',
            scripts: {
              test: 'jest'
            }
          },
          'index.js': 'console.log("Hello World");',
          'src/utils.js': 'export function add(a, b) { return a + b; }'
        },
        dependencies: {},
        devDependencies: {
          jest: '^29.0.0'
        }
      },

      'react-project': {
        type: 'react',
        framework: 'react',
        packageManager: 'npm',
        files: {
          'package.json': {
            name: 'test-react-project',
            version: '1.0.0',
            dependencies: {
              react: '^18.0.0',
              'react-dom': '^18.0.0'
            },
            devDependencies: {
              '@testing-library/react': '^13.0.0',
              '@testing-library/jest-dom': '^5.16.0',
              jest: '^29.0.0'
            }
          },
          'src/App.jsx': `
import React from 'react';

function App() {
  return <div>Hello React</div>;
}

export default App;
          `,
          'src/components/Button.jsx': `
import React from 'react';

export function Button({ children, onClick }) {
  return <button onClick={onClick}>{children}</button>;
}
          `,
          'src/App.test.jsx': `
import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders app component', () => {
  render(<App />);
  expect(screen.getByText('Hello React')).toBeInTheDocument();
});
          `,
          'src/components/Button.test.jsx': `
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

test('renders button with children', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByText('Click me')).toBeInTheDocument();
});
          `
        }
      },

      'python-project': {
        type: 'python',
        files: {
          'requirements.txt': 'pytest==7.0.0\nrequests==2.28.0',
          'main.py': 'def main():\n    print("Hello Python")\n\nif __name__ == "__main__":\n    main()',
          'src/__init__.py': '',
          'src/utils.py': 'def add(a, b):\n    return a + b\n\ndef multiply(a, b):\n    return a * b'
        }
      },

      'mcp-server': {
        type: 'mcp-server',
        framework: 'mcp',
        packageManager: 'npm',
        files: {
          'package.json': {
            name: 'test-mcp-server',
            version: '1.0.0',
            dependencies: {
              '@modelcontextprotocol/sdk': '^1.0.0'
            },
            devDependencies: {
              jest: '^29.0.0'
            }
          },
          'src/server.js': 'import { Server } from "@modelcontextprotocol/sdk/server.js";\n\nconst server = new Server();'
        }
      },

      'vue-project': {
        type: 'node-js',
        framework: 'vue',
        packageManager: 'npm',
        files: {
          'package.json': {
            name: 'test-vue-project',
            version: '1.0.0',
            dependencies: {
              vue: '^3.3.0'
            },
            devDependencies: {
              '@vue/cli': '^5.0.0',
              '@vue/test-utils': '^2.4.0',
              vitest: '^0.30.0'
            }
          },
          'src/App.vue': `
<template>
  <div id="app">
    <h1>{{ message }}</h1>
    <button @click="updateMessage">Click me</button>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      message: 'Hello Vue!'
    }
  },
  methods: {
    updateMessage() {
      this.message = 'Vue is awesome!';
    }
  }
}
</script>
          `,
          'src/components/HelloWorld.vue': `
<template>
  <div class="hello">
    <h2>{{ msg }}</h2>
  </div>
</template>

<script>
export default {
  name: 'HelloWorld',
  props: {
    msg: String
  }
}
</script>
          `,
          'src/App.test.js': `
import { mount } from '@vue/test-utils';
import App from './App.vue';

test('renders app component', () => {
  const wrapper = mount(App);
  expect(wrapper.text()).toContain('Hello Vue!');
});
          `
        }
      },

      'fastapi-project': {
        type: 'python',
        framework: 'fastapi',
        files: {
          'requirements.txt': 'fastapi==0.100.0\nuvicorn[standard]==0.23.0\npydantic==2.0.0\npytest==7.0.0\nhttpx==0.24.0',
          'main.py': `
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class Item(BaseModel):
    name: str
    price: float
    is_offer: bool = False

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/items/{item_id}")
def read_item(item_id: int, q: str = None):
    return {"item_id": item_id, "q": q}

@app.post("/items/")
def create_item(item: Item):
    return item
          `,
          'models.py': `
from pydantic import BaseModel
from typing import Optional

class User(BaseModel):
    id: int
    name: str
    email: str
    is_active: bool = True
          `,
          'test_main.py': `
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"Hello": "World"}

def test_read_item():
    response = client.get("/items/123?q=test")
    assert response.status_code == 200
    assert response.json() == {"item_id": 123, "q": "test"}
          `
        }
      },

      'mixed-project': {
        type: 'mixed',
        files: {
          'package.json': {
            name: 'test-mixed-project',
            version: '1.0.0',
            dependencies: {
              react: '^18.0.0'
            },
            devDependencies: {
              jest: '^29.0.0'
            }
          },
          'requirements.txt': 'fastapi==0.95.0\npytest==7.0.0',
          'src/index.ts': 'export function greet(name: string): string {\n  return `Hello, ${name}!`;\n}',
          'backend/main.py': 'from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get("/")\ndef read_root():\n    return {"Hello": "World"}',
          'backend/__init__.py': ''
        }
      },

      'angular-project': {
        type: 'node-js',
        framework: 'angular',
        packageManager: 'npm',
        files: {
          'package.json': {
            name: 'test-angular-project',
            version: '1.0.0',
            dependencies: {
              '@angular/core': '^16.0.0',
              '@angular/common': '^16.0.0',
              '@angular/platform-browser': '^16.0.0',
              '@angular/platform-browser-dynamic': '^16.0.0',
              'rxjs': '^7.8.0',
              'tslib': '^2.3.0',
              'zone.js': '^0.13.0'
            },
            devDependencies: {
              '@angular/cli': '^16.0.0',
              '@angular-devkit/build-angular': '^16.0.0',
              'typescript': '~5.0.0',
              'jasmine-core': '~4.6.0',
              'karma': '~6.4.0'
            }
          },
          'angular.json': '{}',
          'src/app/app.component.ts': `
import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: '<h1>{{ title }}</h1>',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'Angular App';
}
          `,
          'src/app/app.module.ts': `
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
          `
        }
      },

      'express-project': {
        type: 'node-js',
        framework: 'express',
        packageManager: 'npm',
        files: {
          'package.json': {
            name: 'test-express-project',
            version: '1.0.0',
            dependencies: {
              express: '^4.18.2',
              cors: '^2.8.5',
              'body-parser': '^1.20.0'
            },
            devDependencies: {
              nodemon: '^2.0.22',
              jest: '^29.0.0',
              supertest: '^6.3.0'
            },
            scripts: {
              start: 'node server.js',
              dev: 'nodemon server.js',
              test: 'jest'
            }
          },
          'server.js': `
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.json({ message: 'Express API' });
});

app.get('/api/users', (req, res) => {
  res.json([
    { id: 1, name: 'User 1' },
    { id: 2, name: 'User 2' }
  ]);
});

app.listen(PORT, () => {
  console.log(\`Server is running on port \${PORT}\`);
});

module.exports = app;
          `,
          'routes/index.js': `
const express = require('express');
const router = express.Router();

router.get('/status', (req, res) => {
  res.json({ status: 'OK' });
});

module.exports = router;
          `,
          'test/server.test.js': `
const request = require('supertest');
const app = require('../server');

describe('GET /', () => {
  it('responds with json', async () => {
    const response = await request(app)
      .get('/')
      .expect('Content-Type', /json/)
      .expect(200);
    
    expect(response.body.message).toBe('Express API');
  });
});
          `
        }
      },

      'flask-project': {
        type: 'python',
        framework: 'flask',
        files: {
          'requirements.txt': 'Flask==2.3.0\nFlask-RESTful==0.3.10\nFlask-CORS==4.0.0\nFlask-SQLAlchemy==3.0.0\npytest==7.0.0\npytest-flask==1.2.0',
          'app.py': `
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/')
def home():
    return jsonify({'message': 'Flask API'})

@app.route('/api/users')
def get_users():
    users = [
        {'id': 1, 'name': 'User 1'},
        {'id': 2, 'name': 'User 2'}
    ]
    return jsonify(users)

if __name__ == '__main__':
    app.run(debug=True)
          `,
          'models.py': `
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email
        }
          `,
          'test_app.py': `
import pytest
from app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_home(client):
    response = client.get('/')
    assert response.status_code == 200
    assert response.json['message'] == 'Flask API'

def test_get_users(client):
    response = client.get('/api/users')
    assert response.status_code == 200
    assert len(response.json) == 2
          `
        }
      },

      'django-project': {
        type: 'python',
        framework: 'django',
        files: {
          'requirements.txt': 'Django==4.2.0\ndjango-rest-framework==3.14.0\ndjango-cors-headers==4.0.0\npytest==7.0.0\npytest-django==4.5.0',
          'manage.py': `
#!/usr/bin/env python
import os
import sys

if __name__ == '__main__':
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'myproject.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)
          `,
          'myproject/__init__.py': '',
          'myproject/settings.py': `
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = 'django-insecure-test-key'

DEBUG = True

ALLOWED_HOSTS = []

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'myapp',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'myproject.urls'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
          `,
          'myproject/urls.py': `
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('myapp.urls')),
]
          `,
          'myapp/__init__.py': '',
          'myapp/models.py': `
from django.db import models

class User(models.Model):
    name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
          `,
          'myapp/views.py': `
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.decorators import api_view

@api_view(['GET'])
def hello(request):
    return Response({'message': 'Django API'})
          `,
          'myapp/urls.py': `
from django.urls import path
from . import views

urlpatterns = [
    path('hello/', views.hello),
]
          `
        }
      },

      'svelte-project': {
        type: 'node-js',
        framework: 'svelte',
        packageManager: 'npm',
        files: {
          'package.json': {
            name: 'test-svelte-project',
            version: '1.0.0',
            type: 'module',
            scripts: {
              dev: 'vite dev',
              build: 'vite build',
              test: 'vitest'
            },
            devDependencies: {
              svelte: '^4.0.0',
              '@sveltejs/kit': '^1.20.0',
              '@sveltejs/adapter-auto': '^2.0.0',
              'svelte-preprocess': '^5.0.0',
              vite: '^4.4.0',
              vitest: '^0.34.0',
              '@testing-library/svelte': '^4.0.0'
            }
          },
          'svelte.config.js': `
import adapter from '@sveltejs/adapter-auto';
import preprocess from 'svelte-preprocess';

export default {
  preprocess: preprocess(),
  kit: {
    adapter: adapter()
  }
};
          `,
          'src/app.html': `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    %sveltekit.head%
  </head>
  <body>
    <div>%sveltekit.body%</div>
  </body>
</html>
          `,
          'src/routes/+page.svelte': `
<script>
  let count = 0;
  
  function increment() {
    count += 1;
  }
</script>

<h1>Hello Svelte!</h1>
<button on:click={increment}>
  Count: {count}
</button>
          `,
          'src/lib/Counter.svelte': `
<script>
  export let initialValue = 0;
  let count = initialValue;
  
  function increment() {
    count += 1;
  }
</script>

<button on:click={increment}>
  Count: {count}
</button>
          `
        }
      },

      'nuxt-project': {
        type: 'node-js',
        framework: 'nuxt',
        packageManager: 'npm',
        files: {
          'package.json': {
            name: 'test-nuxt-project',
            version: '1.0.0',
            scripts: {
              dev: 'nuxt dev',
              build: 'nuxt build',
              start: 'nuxt start',
              test: 'vitest'
            },
            devDependencies: {
              nuxt: '^3.6.0',
              '@nuxt/kit': '^3.6.0',
              '@nuxt/test-utils': '^3.6.0',
              vitest: '^0.34.0',
              '@vue/test-utils': '^2.4.0'
            }
          },
          'nuxt.config.ts': `
export default defineNuxtConfig({
  devtools: { enabled: true }
})
          `,
          'app.vue': `
<template>
  <div>
    <h1>{{ title }}</h1>
    <NuxtPage />
  </div>
</template>

<script setup>
const title = ref('Hello Nuxt!');
</script>
          `,
          'pages/index.vue': `
<template>
  <div>
    <h2>Welcome to Nuxt 3</h2>
    <p>Count: {{ count }}</p>
    <button @click="increment">Increment</button>
  </div>
</template>

<script setup>
const count = ref(0);

function increment() {
  count.value++;
}
</script>
          `,
          'components/TheHeader.vue': `
<template>
  <header>
    <h1>{{ props.title }}</h1>
  </header>
</template>

<script setup>
const props = defineProps({
  title: {
    type: String,
    default: 'Nuxt App'
  }
});
</script>
          `
        }
      }
    };

    const template = templates[templateId];
    if (!template) {
      throw new Error(`Unknown template ID: ${templateId}`);
    }

    return template;
  }

  private async createProjectFromTemplate(projectPath: string, template: ProjectTemplate): Promise<void> {
    await fs.mkdir(projectPath, { recursive: true });

    for (const [filePath, content] of Object.entries(template.files)) {
      const fullPath = path.join(projectPath, filePath);
      const dir = path.dirname(fullPath);
      
      await fs.mkdir(dir, { recursive: true });

      if (typeof content === 'object') {
        await fs.writeFile(fullPath, JSON.stringify(content, null, 2));
      } else {
        await fs.writeFile(fullPath, content);
      }
    }

    // Create package-lock.json for npm projects
    if (template.packageManager === 'npm' && template.files['package.json']) {
      await fs.writeFile(path.join(projectPath, 'package-lock.json'), '{}');
    }
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
}

// Global instance for easy access
export const testFixtureManager = TestFixtureManager.getInstance();