export enum ConnectorSource {
  OPENAPI = "openapi",
  MANUAL = "manual",
  PLATFORM = "platform",
  POSTMAN = "postman",

  // Legacy values kept for backward compatibility with existing persisted rows.
  TOOL = "tool",
  CUSTOM = "custom",
}
