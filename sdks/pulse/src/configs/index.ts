export interface EnvConfig {
  baseUrl: string;
}

export const getEnvConfig = (): EnvConfig => {
  return {
    baseUrl: "http://localhost:3000/api/v1",
  };
};
