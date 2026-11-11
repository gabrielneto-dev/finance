// Configuração dinâmica do app (SPEC-0005, REQ-006). O google-services.json do Firebase fica fora do Git,
// porque o repositório é público. No EAS, ele chega como variável de ambiente do tipo arquivo
// (GOOGLE_SERVICES_JSON); localmente, como ./google-services.json, se existir.
const { existsSync } = require("fs");

module.exports = ({ config }) => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || (existsSync("./google-services.json") ? "./google-services.json" : undefined);
  return { ...config, android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) } };
};
