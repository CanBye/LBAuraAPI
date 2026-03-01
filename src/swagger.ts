export const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "LBAuraAPI",
    version: "1.0.0",
    description: "LBAuraAPI - Discord Presence API, Lanyard compatible with extra features",
  },
  servers: [{ url: "/" }],
  paths: {
    "/v1/users/{user_id}": {
      get: {
        summary: "Get user presence",
        parameters: [
          { name: "user_id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "User presence data" },
          "404": { description: "User not found" },
        },
      },
    },
    "/v1/users": {
      get: {
        summary: "Bulk get user presences",
        parameters: [
          { name: "ids", in: "query", required: true, schema: { type: "string" }, description: "Comma-separated user IDs (max 50)" },
        ],
        responses: {
          "200": { description: "Map of user presences" },
        },
      },
    },
    "/v1/users/{user_id}/kv/{key}": {
      put: {
        summary: "Set a KV pair",
        security: [{ ApiKey: [] }],
        parameters: [
          { name: "user_id", in: "path", required: true, schema: { type: "string" } },
          { name: "key", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: { content: { "text/plain": { schema: { type: "string" } } } },
        responses: { "200": { description: "Success" } },
      },
      delete: {
        summary: "Delete a KV pair",
        security: [{ ApiKey: [] }],
        parameters: [
          { name: "user_id", in: "path", required: true, schema: { type: "string" } },
          { name: "key", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Success" } },
      },
    },
    "/v1/users/{user_id}/kv": {
      patch: {
        summary: "Bulk set KV pairs",
        security: [{ ApiKey: [] }],
        parameters: [
          { name: "user_id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: { "application/json": { schema: { type: "object", additionalProperties: { type: "string" } } } },
        },
        responses: { "200": { description: "Success" } },
      },
    },
    "/v1/health": {
      get: {
        summary: "Health check",
        responses: { "200": { description: "Service health info" } },
      },
    },
  },
  components: {
    securitySchemes: {
      ApiKey: { type: "apiKey", in: "header", name: "Authorization" },
    },
  },
};
