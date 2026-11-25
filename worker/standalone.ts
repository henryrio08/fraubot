import worker from "./index";
import { handleGuestRequest } from "../lib/guest-session.mjs";

export default {
  fetch(request: Request, env: Cloudflare.Env, ctx: Parameters<typeof worker.fetch>[2]) {
    const standaloneEnv = { ...env, AUTH_MODE: "nickname" };
    return handleGuestRequest(request, standaloneEnv,
      (authenticated: Request) => worker.fetch(authenticated, standaloneEnv, ctx),
      { allowLocalHttp: import.meta.env.DEV });
  },
};
