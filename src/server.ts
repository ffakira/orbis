import app from './app.js';

const port = Number(process.env.PORT ?? 3000);

const server = app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});

const shutdown = (signal: string): void => {
  console.info(`Received ${signal}. Shutting down...`);

  server.close((error) => {
    if (error) {
      console.error('Shutdown failed:', error);
      process.exitCode = 1;
    }
  });
};

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
