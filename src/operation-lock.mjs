let tail = Promise.resolve();

export function withOperationLock(action) {
  const previous = tail;
  let release;
  tail = new Promise((resolve) => { release = resolve; });
  return previous.then(action).finally(release);
}
