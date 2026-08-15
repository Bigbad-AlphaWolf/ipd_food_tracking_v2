import { FunctionsHttpError } from '@supabase/supabase-js';

/**
 * supabase.functions.invoke() rejects non-2xx responses with a generic
 * "Edge Function returned a non-2xx status code" message — the actual
 * `{ error: "..." }` body our functions return has to be read separately
 * off the raw Response in `error.context`.
 */
export async function resolveEdgeFunctionError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string };

      if (body?.error) {
        return new Error(body.error);
      }
    } catch {
      // Body wasn't JSON — fall through to the generic error below.
    }
  }

  return error instanceof Error ? error : new Error('Unexpected error calling the edge function.');
}
