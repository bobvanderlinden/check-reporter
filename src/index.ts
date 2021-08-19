import { NextFunction, Request, RequestHandler } from "express";
import { ApplicationFunctionOptions, Probot, run } from "probot";
import { use } from "./db";

function wrapAsync(
  fn: (req: Request, res: Response, next: NextFunction) => any
): RequestHandler {
  return (req, res, next) => {
    fn(req, res as any, next)
      .then(() => {
        res.end();
      })
      .catch((error: Error) => {
        if (error instanceof HttpError) {
          res.statusCode = error.status;
          console.log("error", error.message);
          res.end(error.message);
        }
        next(error);
      });
  };
}

class HttpError extends Error {
  public status: number;
  constructor(data: { status: number; message: string }) {
    super(data.message);
    this.status = data.status;
  }

  toString(): string {
    return `[HttpError status=${this.status} message=${this.message}]`;
  }
}

export function app(app: Probot, { getRouter }: ApplicationFunctionOptions) {
  if (!getRouter) {
    throw new Error("getRouter is undefined");
  }
  const router = getRouter("/api");

  router.use(require("body-parser").json());

  router.post(
    "/push",
    wrapAsync(async (req, res) => {
      console.log("hallo");
      if (!req.headers.authorization) {
        throw new HttpError({
          status: 401,
          message: "No authorization header",
        });
      }
      const [authenticationMethod, authenticationToken] =
        req.headers.authorization.split(" ", 2);
      if (authenticationMethod !== "Bearer") {
        throw new HttpError({
          status: 400,
          message: "Invalid authentication header",
        });
      }
      await use(async (db) => {
        const { rows } = await db.query(
          "select installation_id, owner, repo from tokens where token = $1",
          [authenticationToken]
        );
        if (rows.length === 0) {
          throw new HttpError({
            status: 401,
            message: "Unrecognized token",
          });
        }
        if (rows.length > 1) {
          throw new Error("Multiple rows for token");
        }
        const { installation_id, owner, repo } = rows[0];
        const github = await app.auth(installation_id, app.log);
        await github.checks.create({
          ...req.body,
          owner,
          repo,
        });
      });
    })
  );
}

run(app);
