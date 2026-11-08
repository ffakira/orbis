export function createAsyncSingleton<T>(
  factory: () => Promise<T>,
): () => Promise<T> {
  let instance: Promise<T> | undefined;

  return function getInstance(): Promise<T> {
    if (instance) {
      return instance;
    }

    instance = factory().catch((error: unknown) => {
      instance = undefined;
      throw error;
    });

    return instance;
  };
}
