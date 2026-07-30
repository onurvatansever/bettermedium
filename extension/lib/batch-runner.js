export async function runConcurrent(
  items,
  worker,
  {
    concurrency = 4,
    onError,
    onSettled,
    shouldStop = () => false
  } = {}
) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runWorker() {
    while (!shouldStop()) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) {
        return;
      }

      let result;
      try {
        result = await worker(items[index], index);
      } catch (error) {
        if (!onError) {
          throw error;
        }
        result = await onError(error, items[index], index);
      }

      if (shouldStop()) {
        return;
      }

      results[index] = result;
      await onSettled?.(result, index);
    }
  }

  const workerCount = Math.min(
    Math.max(1, Math.trunc(concurrency) || 1),
    Math.max(1, items.length)
  );
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  return results.filter((result) => result !== undefined);
}
