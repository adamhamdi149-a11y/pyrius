// The app shares the web app's pure modules (types, plans, airports, orb themes, flight helpers)
// from ../src, imported as "@/lib/...". Metro has to watch that folder to bundle it.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, "../src")];
// Shared files resolve packages from the app's own node_modules, never the web app's.
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];

module.exports = config;
