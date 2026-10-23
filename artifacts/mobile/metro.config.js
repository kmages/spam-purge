const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The web app in this monorepo pins React 19.1.0, so pnpm gives @workspace/api-client-react its own
// copy of @tanstack/react-query. Two copies means the generated hooks can't see this app's
// QueryClientProvider, which crashed the app on the first screen that fetches data.
// Resolve these from the app's own folder so the whole bundle shares one copy.
const SINGLETONS = ['react', 'react-native', '@tanstack/react-query'];
const appEntry = path.join(__dirname, 'package.json');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isSingleton = SINGLETONS.some((name) => moduleName === name || moduleName.startsWith(`${name}/`));
  if (isSingleton) {
    return context.resolveRequest({ ...context, originModulePath: appEntry }, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
