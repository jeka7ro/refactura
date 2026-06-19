export class TRPCError extends Error {
  public code: string;
  constructor(opts: { code: string; message?: string; cause?: Error }) {
    super(opts.message ?? opts.code);
    this.code = opts.code;
    this.name = "TRPCError";
    this.cause = opts.cause;
  }
}
