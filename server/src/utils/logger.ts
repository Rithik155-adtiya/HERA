import winston from 'winston';
import { config } from '../config/env';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  let log = `${ts} [${level}]: ${message}`;
  if (stack) log += `\n${stack}`;
  if (Object.keys(meta).length > 0) log += `\n${JSON.stringify(meta, null, 2)}`;
  return log;
});

export const logger = winston.createLogger({
  level: config.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    config.NODE_ENV === 'development'
      ? combine(colorize(), logFormat)
      : winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      silent: config.NODE_ENV === 'test',
    }),
  ],
});
