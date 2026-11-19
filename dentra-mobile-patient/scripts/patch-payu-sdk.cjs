/* eslint-env node, es2021 */
// PayU 4.3.0's RN 0.82+ HTTP helper disables TLS validation on Android and logs
// checkout payloads. Keep the native networking fix without those behaviours.
// This runs after every install; fail explicitly if an upstream update changes the patch.
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const root = join(__dirname, '../node_modules/payu-non-seam-less-react');
const version = require(join(root, 'package.json')).version;
if (version !== '4.3.0')
  throw new Error(
    'Review PayU native networking patch before changing SDK version.',
  );
const android = join(
  root,
  'android/src/main/java/com/payubiz/PayUBizSdkModule.java',
);
let java = readFileSync(android, 'utf8');
const start = java.indexOf(
  '            // Install the all-trusting trust manager',
);
if (start !== -1) {
  const end = java.indexOf('            URL requestUrl = new URL(url);', start);
  if (end === -1) throw new Error('PayU TLS patch did not match.');
  java =
    java.slice(0, start) +
    '            // Dentra: use platform TLS certificate validation.\n' +
    java.slice(end);
}
if (!java.includes('// Dentra: use platform TLS certificate validation.'))
  throw new Error('PayU TLS patch is missing.');
java = java.replace(
  /^[ \t]*Log\.d\("PayUBizSdk", "(?:HTTP Request:|Request Body:|HTTP Response Code:|HTTP Response:)[^\n]*\n/gm,
  '',
);
java = java.replace(
  'connection.setRequestMethod(method.toUpperCase());',
  'connection.setRequestMethod(method.toUpperCase());\n            connection.setInstanceFollowRedirects(false);',
);
// Make repeated postinstall runs idempotent.
java = java.replace(
  /( {12}connection.setInstanceFollowRedirects\(false\);\n)+/g,
  '            connection.setInstanceFollowRedirects(false);\n',
);
// Do not retain a new executor thread for every SDK hash request.
const executorEnd =
  '                    promise.reject("HTTP_ERROR", e.getMessage());\n                }\n            }';
if (java.includes(executorEnd)) {
  java = java.replace(
    executorEnd,
    '                    promise.reject("HTTP_ERROR", e.getMessage());\n                } finally {\n                    executor.shutdown();\n                }\n            }',
  );
}
writeFileSync(android, java);
const ios = join(root, 'ios/PayUBizSdk.m');
let objc = readFileSync(ios, 'utf8');
objc = objc.replace(
  /^[ \t]*NSLog\(@"PayUBizSdk: (?:HTTP Request:|Request Body:|HTTP Response Code:|HTTP Response:)[^\n]*\n/gm,
  '',
);
writeFileSync(ios, objc);
