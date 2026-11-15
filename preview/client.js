// Offline preview client: the in-memory database with sample data.
import { createClient as mockClient } from './mock-supabase.js';
import { seed } from './sample-data.js';
export function createClient() {
  const client = mockClient();
  seed(window.__mock);
  return client;
}
