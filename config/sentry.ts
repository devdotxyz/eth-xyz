import Env from '@ioc:Adonis/Core/Env'
const sentryConfig = {
  dsn: Env.get('SENTRY_DSN'),
  enabled: Env.get('SENTRY_DSN') !== '',
  beforeSend(event, hint) {
    if (Env.get('NODE_ENV') === 'development') {
      console.error(hint.originalException || hint.syntheticException);
      return null; // this drops the event and nothing will be sent to sentry
    }
    return event;
  }
}

export default sentryConfig
