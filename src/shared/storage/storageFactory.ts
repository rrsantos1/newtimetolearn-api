import { BackblazeStorageProvider } from "./providers/BackblazeStorageProvider";
import type { IStorageProvider } from "./interfaces/IStorageProvider";

let storageProvider: IStorageProvider | null = null;

export function makeStorageProvider(): IStorageProvider {
  storageProvider ??= new BackblazeStorageProvider();
  return storageProvider;
}
