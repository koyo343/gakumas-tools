// Map an async iterable through `fn`, pulling the next item while earlier
// calls are still running but never letting more than `limit` run at once.
// Results keep the input order. Stops pulling at the first failed call.
export async function mapWithLimit(iterable, limit, fn) {
  const results = [];
  const inFlight = new Set();
  let failure = null;
  for await (const item of iterable) {
    const call = fn(item);
    results.push(call);
    inFlight.add(call);
    call.then(
      () => inFlight.delete(call),
      (error) => {
        failure ??= { error };
        inFlight.delete(call);
      },
    );
    if (failure) throw failure.error;
    if (inFlight.size >= limit) await Promise.race(inFlight);
  }
  return Promise.all(results);
}
