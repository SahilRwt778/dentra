/** A UUID for request deduplication, not an authentication credential. */
export function createRequestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, letter => {
    const value = Math.floor(Math.random() * 16);
    return (letter === 'x' ? value : (value % 4) + 8).toString(16);
  });
}
