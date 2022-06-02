import Env from '@ioc:Adonis/Core/Env'

if (Env.get('SENTRY_DSN') !== '') {
  const sentryConfig = {
    dsn: Env.get('SENTRY_DSN'),
    enabled: true,
  }
} else {
  const sentryConfig = {
    dsn: Env.get('SENTRY_DSN'),
    enabled: false,
  }
}

export default sentryConfig;
