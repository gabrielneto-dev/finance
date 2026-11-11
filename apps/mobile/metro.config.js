// Metro do app Finance (SPEC-0005). O app reaproveita funções puras e tipos do web em ../web/lib,
// sem copiar: a pasta entra em watchFolders para o Metro enxergar arquivos fora do projeto.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, "../web/lib")];
module.exports = config;
