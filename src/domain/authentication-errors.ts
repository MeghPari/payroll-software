export function authenticationFailure(error: { status?: number; name?: string },purpose:'login'|'session'='login') {
  if (error.status === 429) return { status: 429, code: 'RATE_LIMITED', message: purpose==='session'?'The authentication service is busy. Please wait before retrying.':'Too many sign-in attempts. Please wait before trying again.' };
  if (error.name === 'AuthRetryableFetchError' || error.status === undefined || error.status === 0 || error.status >= 500) {
    return { status: 503, code: 'AUTH_UNAVAILABLE', message: 'Unable to connect to the authentication service. Please try again shortly.' };
  }
  return { status: 401, code: purpose==='session'?'UNAUTHENTICATED':'LOGIN_FAILED', message: purpose==='session'?'Sign in to continue.':'Unable to sign in. Check your email and password.' };
}
