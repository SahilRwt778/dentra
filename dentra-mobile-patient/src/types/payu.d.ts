declare module 'payu-non-seam-less-react' {
  const sdk:
    | {
        openCheckoutScreen(options: unknown): void;
        hashGenerated(hashes: Record<string, string>): void;
        makeHttpRequest(
          url: string,
          method: string,
          body: string,
          headers: Record<string, string>,
        ): Promise<string>;
        addListener(event: string): void;
        removeListeners(count: number): void;
      }
    | undefined;
  export default sdk;
}
