import { Application } from 'probot' // eslint-disable-line no-unused-vars
import { use } from './db'

class HttpError extends Error {
  public status: number
  constructor(data: {status: number, message: string}) {
    super(data.message)
    this.status = data.status
  }

  toString(): string {
    return `[HttpError status=${this.status} message=${this.message}]`
  }
}

export = (app: Application) => {
  const router = app.route('/api')

  router.use(require('body-parser').json())

  router.post('/push', (req: any, res: any) => {
    (async () => {
      const [authenticationMethod, authenticationToken] = req.headers.authorization.split(' ', 2)
      if (authenticationMethod !== 'Bearer') {
        throw new HttpError({
          status: 400,
          message: 'Invalid authentication header'
        })
      }
      await use(async (db) => {
        const { rows } = await db.query('select installation_id, owner, repo from tokens where token = $1', [authenticationToken])
        if (rows.length === 0) {
          throw new HttpError({
            status: 401,
            message: 'Unrecognized token'
          })
        }
        if (rows.length > 1) {
          throw new Error('Multiple rows for token')
        }
        const { installation_id, owner, repo } = rows[0]
        const github = await app.auth(installation_id, app.log)
        await github.checks.create({
          ...req.body,
          owner,
          repo
        })
      })
    })().then(() => {
      res.end()
    }).catch(err => {
      app.log('Error handling push request', err)
      if (err instanceof HttpError) {
        res.status(err.status).end()
      } else {
        res.status(500).end()
      }
    })
  })
}
