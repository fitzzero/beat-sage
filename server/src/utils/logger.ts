import winston from "winston";

// Custom format for concise console output with styling
const consoleFormat = winston.format.printf(
  ({ level, message, timestamp, ...meta }) => {
    const time = new Date(timestamp as string).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    // Extract location/service and identifiers for display
    const metaObj = meta as Record<string, unknown>;
    const location = (metaObj.service as string) || "Unknown";
    const userId =
      metaObj.userId && typeof metaObj.userId === "string"
        ? ` ${metaObj.userId.slice(0, 8)}...`
        : "";
    const socketId =
      metaObj.socketId && typeof metaObj.socketId === "string"
        ? ` [${metaObj.socketId.slice(0, 8)}...]`
        : "";

    // Style components with colors
    const levelColors = {
      error: "\x1b[31m", // Red
      warn: "\x1b[33m", // Yellow
      info: "\x1b[32m", // Green
      debug: "\x1b[36m", // Cyan
    };
    const levelColor =
      levelColors[level as keyof typeof levelColors] || "\x1b[37m"; // Default white
    const styledLevel = `${levelColor}(${level.toUpperCase()})\x1b[0m`; // Reset after

    // Make time and location subtle grey, keep level styled
    const styledTimeLocation = `\x1b[2m${time} @ ${location}\x1b[0m`; // Dim grey

    return `${styledTimeLocation} ${styledLevel}:\n${String(
      message
    )}${userId}${socketId}`;
  }
);

// Enhanced JSON format for LLM analysis
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const {
      timestamp,
      level,
      message,
      service,
      userId,
      socketId,
      error,
      ...meta
    } = info;

    // Create human-readable timestamp for LLM parsing
    const humanTime = new Date(timestamp as string).toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    // Enhanced structured log for LLM analysis
    const logEntry: Record<string, unknown> = {
      timestamp: timestamp,
      humanTime: humanTime,
      level: level.toUpperCase(),
      service: service || "Unknown",
      message: String(message),
      category: categorizeLogMessage(String(message), level),
    };

    // Add context information if present
    if (userId) {
      logEntry.userId = String(userId).slice(0, 12) + "...";
    }
    if (socketId) {
      logEntry.socketId = String(socketId).slice(0, 12) + "...";
    }

    // Add error details if present and properly structured
    if (error && typeof error === "object" && error instanceof Error) {
      logEntry.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    }

    // Add additional metadata if present
    if (Object.keys(meta).length > 0) {
      logEntry.metadata = meta;
    }

    // Add service-specific context
    if (service) {
      const context = getServiceContext(String(service), String(message));
      if (Object.keys(context).length > 0) {
        logEntry.serviceContext = context;
      }
    }

    return JSON.stringify(logEntry);
  })
);

// Helper function to categorize log messages for LLM analysis
function categorizeLogMessage(message: string, level: string): string {
  const msgLower = message.toLowerCase();

  if (level === "error") return "error";
  if (msgLower.includes("server listening") || msgLower.includes("starting"))
    return "startup";
  if (
    msgLower.includes("registered service") ||
    msgLower.includes("discovered")
  )
    return "service_discovery";
  if (msgLower.includes("registering socket")) return "socket_registration";
  if (msgLower.includes("authenticated") || msgLower.includes("authentication"))
    return "authentication";
  if (msgLower.includes("subscribed") || msgLower.includes("unsubscribed"))
    return "subscription";
  if (
    msgLower.includes("created") ||
    msgLower.includes("updated") ||
    msgLower.includes("deleted")
  )
    return "data_operation";
  if (msgLower.includes("handling") || msgLower.includes("processing"))
    return "request_processing";

  return "general";
}

// Helper function to extract service-specific context
function getServiceContext(
  service: string,
  message: string
): Record<string, unknown> {
  const context: Record<string, unknown> = {};

  // Extract common patterns for better LLM understanding
  const serviceMatch = message.match(/service[:\s]+(\w+)/i);
  if (serviceMatch) context.targetService = serviceMatch[1];

  const eventMatch = message.match(/event[:\s]+([a-zA-Z:_]+)/i);
  if (eventMatch) context.socketEvent = eventMatch[1];

  const portMatch = message.match(/port\s+(\d+)/i);
  if (portMatch) context.port = parseInt(portMatch[1]);

  const countMatch = message.match(/(\d+)\s+(?:public\s+)?methods?/i);
  if (countMatch) context.methodCount = parseInt(countMatch[1]);

  return context;
}

const isTestEnv = process.env.NODE_ENV === "test";

const logger = winston.createLogger({
  level: isTestEnv ? "warn" : "info",
  // Silence logs during tests to avoid disk I/O and speed up the suite
  silent: isTestEnv,
  transports: [
    // File transport: Detailed JSON for LLM analysis (disabled in tests)
    ...(!isTestEnv
      ? [
          new winston.transports.File({
            filename: "logs/combined.log",
            format: fileFormat,
          }),
        ]
      : []),

    // Console transport: Concise human-readable (only in non-test environments)
    ...(!isTestEnv
      ? [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.timestamp(),
              consoleFormat
            ),
          }),
        ]
      : []),
  ],
});

export default logger;

// Evergreen comment: Dual-format logger - detailed JSON for files (LLM analysis), concise console for development.
