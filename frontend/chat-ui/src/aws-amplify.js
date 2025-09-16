let cachedConfiguration = {};
let hasWarned = false;

function warnOnce() {
  if (hasWarned || typeof console === 'undefined') {
    return;
  }

  console.warn(
    'aws-amplify package not detected. Using a no-op Amplify stub — configuration changes will be ignored.'
  );
  hasWarned = true;
}

export const Amplify = {
  configure(config = {}) {
    warnOnce();
    cachedConfiguration = { ...cachedConfiguration, ...config };
    return cachedConfiguration;
  }
};

export function __getAmplifyConfig() {
  return cachedConfiguration;
}
