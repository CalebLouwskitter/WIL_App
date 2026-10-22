// Lets `node -r ./scripts/registerTs.js some-script.ts` run the repo's
// TypeScript with the same Babel preset the app and Jest use, so scripts can
// import app modules without adding a TypeScript runner dependency.
const fs = require('fs');
const path = require('path');
const Module = require('module');
const babel = require('@babel/core');

const root = path.join(__dirname, '..');

for (const ext of ['.ts', '.tsx']) {
  Module._extensions[ext] = (module, filename) => {
    const { code } = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
      filename,
      cwd: root,
      caller: { name: 'register-ts', supportsStaticESM: false },
    });
    module._compile(code, filename);
  };
}
