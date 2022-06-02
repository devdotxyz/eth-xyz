import Env from '@ioc:Adonis/Core/Env'

const sentryConfig = {
  dsn: Env.get('SENTRY_DSN'),
  enabled: Env.get('SENTRY_DSN') !== '',
}

export default sentryConfig;
