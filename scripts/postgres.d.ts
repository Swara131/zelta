declare module "postgres" {
  export default function postgres(
    url: string,
    options?: { max?: number }
  ): {
    unsafe(query: string): Promise<unknown>;
    end(options?: { timeout?: number }): Promise<void>;
  };
}
