/** FIFO work with a bounded count of running + waiting operations; failures drain. */
export function createSerialQueue(
  options: { maxPending?: number; onFull?: () => Error } = {},
) {
  const maximum = options.maxPending ?? Infinity;
  if (maximum !== Infinity && (!Number.isInteger(maximum) || maximum < 1))
    throw new RangeError("maxPending must be a positive integer");
  let pending = 0;
  let tail: Promise<void> = Promise.resolve();
  return function run<T>(operation: () => Promise<T>): Promise<T> {
    if (pending >= maximum)
      return Promise.reject(
        options.onFull?.() ?? new Error("Work queue is full"),
      );
    pending++;
    const result = tail.then(operation).finally(() => {
      pending--;
    });
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}
