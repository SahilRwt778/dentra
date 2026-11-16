const readPublicEnvironment = require('./public-environment.cjs');

// Only public app configuration is embedded. API secrets are never read.
module.exports = function ({ types }) {
  const environment = readPublicEnvironment();
  return {
    visitor: {
      MemberExpression(expression) {
        const node = expression.node;
        if (
          !node.computed &&
          types.isIdentifier(node.property) &&
          Object.hasOwn(environment, node.property.name) &&
          types.isMemberExpression(node.object) &&
          types.isIdentifier(node.object.object, { name: 'process' }) &&
          types.isIdentifier(node.object.property, { name: 'env' })
        ) {
          expression.replaceWith(
            types.valueToNode(environment[node.property.name])
          );
        }
      },
    },
  };
};
