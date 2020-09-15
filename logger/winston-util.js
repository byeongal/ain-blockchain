const winston = require('winston');
const winstonDaily = require('winston-daily-rotate-file');
const path = require('path');
const { DEBUG, PORT, ACCOUNT_INDEX } = require('../constants');

const { combine, timestamp, label, printf } = winston.format;

const logDir = path.join(__dirname, '.', 'logs', String(PORT));
const prefix = `node-${ACCOUNT_INDEX}`;
const logFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

// XXX(minsu): we are able to set new winston log levels when necessary in the near future.
const getWinstonLevels = () => {
  return {
    'info': 0,
    'debug': 1,
    'error': 2
  };
}

const getWinstonConsoleTransport = () => {
  return new (winston.transports.Console) ({
    name: 'debug-console-log',
    level: DEBUG ? 'debug' : 'info',
    handleExceptions: true,
    json: false,
    colorize: true,
    format: combine(
      label({ label: prefix }),
      timestamp(),
      logFormat
    ),
  });
};

const getWinstonDailyDebugFileTransport = () => {
  return new (winstonDaily) ({
    name: 'daily-combined-log',
    level: 'debug',
    filename: `${logDir}/${prefix}-combined-%DATE%.log`,
    handleExceptions: true,
    json: false,
    maxSize: '100m',
    maxFiles: '14d',
    colorize: false,
    format: combine(
      label({ label: prefix }),
      timestamp(),
      logFormat
    ),
  });
};

const getWinstonDailyErrorFileTransport = () => {
  return new (winstonDaily) ({
    name: 'daily-error-log',
    level: 'error',
    filename: `${logDir}/${prefix}-error-%DATE%.log`,
    handleExceptions: true,
    json: false,
    maxSize: '100m',
    maxFiles: '180d',
    colorize: false,
    format: combine(
      label({ label: prefix }),
      timestamp(),
      logFormat
    )
  });
};

module.exports = {
  getWinstonLevels,
  getWinstonConsoleTransport,
  getWinstonDailyDebugFileTransport,
  getWinstonDailyErrorFileTransport,
};