module.exports = ({ config }) => {
  const googleServicesFile = process.env.YARIVA_GOOGLE_SERVICES_FILE?.trim();
  if (!googleServicesFile) return config;

  return { ...config, android: { ...config.android, googleServicesFile } };
};
