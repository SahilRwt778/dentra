const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

// Only public app configuration is embedded. API secrets are never read.
module.exports = function ({ types }) {
  const file = path.join(__dirname, '.env');
  const local = fs.existsSync(file)
    ? parseEnv(fs.readFileSync(file, 'utf8'))
    : {};
  const allowed = new Set(['DENTRA_API_URL', 'DENTRA_SUPPORT_EMAIL', 'DENTRA_PUSH_ENABLED', 'DENTRA_PUSH_IOS_ENABLED']);
  return {
    visitor: {
      MemberExpression(expression) {
        const node = expression.node;
        if (
          !node.computed &&
          types.isIdentifier(node.property) &&
          allowed.has(node.property.name) &&
          types.isMemberExpression(node.object) &&
          types.isIdentifier(node.object.object, { name: 'process' }) &&
          types.isIdentifier(node.object.property, { name: 'env' })
        ) {
          expression.replaceWith(
            types.valueToNode(
              process.env[node.property.name] ||
                local[node.property.name] ||
                undefined,
            ),
          );
        }
      },
    },
  };
};
