import pino from "pino";

const isDev = process.env.NODE_ENV === "development";

export const logger = isDev
  ? pino({
      transport: {
        target: "pino-pretty",
      },
    })
  : pino();