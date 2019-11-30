const { LOG_LEVEL } = process.env;
const { name: TASK_NAME, version: TASK_VERSION } = require("../package");

module.exports = require("pino")({
  level: LOG_LEVEL,
  messageKey: "message",
  base: {
    name: "allhailbot",
    taskName: TASK_NAME,
    taskVersion: TASK_VERSION,
  },
});
