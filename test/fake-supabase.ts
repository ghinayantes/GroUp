export type FakeResult = { data?: unknown; error?: { message: string } | null; count?: number | null };

export type FakeCall = {
  table?: string;
  rpc?: string;
  args?: Record<string, unknown>;
  ops: [string, ...unknown[]][];
};

type Responder = (call: FakeCall) => FakeResult;

function builder(call: FakeCall, respond: () => Responder) {
  const proxy: unknown = new Proxy(
    {},
    {
      get(_, prop: string) {
        if (prop === "then") {
          return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
            Promise.resolve({ data: null, error: null, count: null, ...respond()(call) }).then(resolve, reject);
        }
        return (...args: unknown[]) => {
          call.ops.push([prop, ...args]);
          return proxy;
        };
      },
    },
  );
  return proxy;
}

export function createFakeSupabase() {
  const calls: FakeCall[] = [];
  let responder: Responder = () => ({});
  const current = () => responder;
  const client = {
    from(table: string) {
      const call: FakeCall = { table, ops: [] };
      calls.push(call);
      return builder(call, current);
    },
    rpc(fn: string, args?: Record<string, unknown>) {
      const call: FakeCall = { rpc: fn, args, ops: [] };
      calls.push(call);
      return builder(call, current);
    },
  };
  return {
    client,
    calls,
    respond(next: Responder) {
      responder = next;
    },
    reset() {
      calls.length = 0;
      responder = () => ({});
    },
    op(call: FakeCall, name: string) {
      return call.ops.filter(([op]) => op === name).map(([, ...args]) => args);
    },
  };
}

export const fakeSupabase = createFakeSupabase();
