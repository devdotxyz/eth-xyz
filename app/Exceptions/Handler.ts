/*
|--------------------------------------------------------------------------
| Http Exception Handler
|--------------------------------------------------------------------------
|
| AdonisJs will forward all exceptions occurred during an HTTP request to
| the following class. You can learn more about exception handling by
| reading docs.
|
| The exception handler extends a base `HttpExceptionHandler` which is not
| mandatory, however it can do lot of heavy lifting to handle the errors
| properly.
|
*/
import Logger from '@ioc:Adonis/Core/Logger'
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import HttpExceptionHandler from '@ioc:Adonis/Core/HttpExceptionHandler'
import * as Sentry from '@sentry/node'
import sentryConfig from '../../config/sentry'

Sentry.init(sentryConfig)

export default class ExceptionHandler extends HttpExceptionHandler {
  protected statusPages = {
    '403': 'errors/unauthorized',
    '404': 'errors/not-found',
    '500..599': 'errors/server-error',
  }

  constructor() {
    super(Logger)
  }

  public async handle(error: any, ctx: HttpContextContract) {
    // Error, capture with Sentry
    if (error.st) Sentry.captureException(error)

    // Only show 500 error when occurring with a third party gateway
    if (
      error.code === 'SERVER_ERROR' &&
      (error.reason.includes('failed to fetch ens subdomain') ||
        error.reason.includes('failed to lookup data'))
    ) {
      return ctx.response.status(500).send({ success: false, ...error })
    }

    return super.handle(error, ctx)
  }
}
