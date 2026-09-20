---
name: setup-pre-commit
description: "Use when setting up Husky pre-commit hooks."
---

1. Detect the package manager from the lockfile (default npm) and use it throughout.
2. Install `husky lint-staged prettier` as devDependencies; `npx husky init`.
3. `.husky/pre-commit` (no shebang needed for Husky v9+; adapt `npm` to the detected manager; omit `typecheck`/`test` lines that have no package.json script, and tell the user):

   ```
   npx lint-staged
   npm run typecheck
   npm run test
   ```

4. `.lintstagedrc`:

   ```json
   {
     "*": "prettier --ignore-unknown --write"
   }
   ```

5. `.prettierrc`, only if no Prettier config exists:

   ```json
   {
     "useTabs": false,
     "tabWidth": 2,
     "printWidth": 80,
     "singleQuote": false,
     "trailingComma": "es5",
     "semi": true,
     "arrowParens": "always"
   }
   ```

6. Verify: `npx lint-staged` runs; `prepare` script is `"husky"`; hook file executable.
7. Commit everything as `Add pre-commit hooks (husky + lint-staged + prettier)` — the commit itself smoke-tests the hooks.
