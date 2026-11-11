import { createHash, createPrivateKey, createPublicKey, timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { Hono } from 'hono'
import { SignJWT } from 'jose'
import { z } from 'zod'
import { loadRelayConfig } from '../config.js'
import { readBearer } from './relay-token-verifier.js'

const AUTH_PATH = '/v1/self-host'
const JWKS_PATH = AUTH_PATH + '/jwks'
const HostRequest = z.object({
  relayHostId: z.string().regex(/^[A-Za-z0-9_-]{16}$/),
  hostPublicKeyB64: z.string().regex(/^[A-Za-z0-9+/]{43}=$/)
})

export async function loadRelayBootConfig(env: NodeJS.ProcessEnv = process.env) {
  if (env.ORCA_SELF_HOSTED_RELAY_URL === undefined) {
    return { config: loadRelayConfig(env) }
  }

  const publicUrl = new URL(env.ORCA_SELF_HOSTED_RELAY_URL.trim())
  if (
    publicUrl.protocol !== 'https:' ||
    publicUrl.username ||
    publicUrl.password ||
    publicUrl.href !== publicUrl.origin + '/'
  ) {
    throw new Error('ORCA_SELF_HOSTED_RELAY_URL must be an HTTPS origin')
  }
  const tokenFile = env.ORCA_SELF_HOSTED_RELAY_TOKEN_FILE?.trim()
  const keyFile = env.ORCA_SELF_HOSTED_RELAY_KEY_FILE?.trim()
  if (!tokenFile || !keyFile) {
    throw new Error('Self-hosted Relay requires a host token file and a signing key file')
  }
  const token = (await readFile(tokenFile, 'utf8')).trim()
  if (!/^[a-f0-9]{64}$/.test(token)) {
    throw new Error('The self-hosted Relay host token must contain 32 random bytes in lowercase hex')
  }
  const signingKey = createPrivateKey(await readFile(keyFile))
  if (signingKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
    throw new Error('The self-hosted Relay signing key must use P-256')
  }
  const publicKey = createPublicKey(signingKey).export({ format: 'jwk' })
  const kid = createHash('sha256').update(JSON.stringify(publicKey)).digest('base64url')
  const tokenDigest = createHash('sha256').update(token).digest()
  const issuer = publicUrl.origin
  const port = env.PORT ?? '8080'
  const config = loadRelayConfig({
    ...env,
    PORT: port,
    ORCA_RELAY_ROLE: 'combined',
    ORCA_RELAY_PUBLIC_URL: publicUrl.origin,
    ORCA_RELAY_CELL_URL: publicUrl.origin,
    ORCA_RELAY_AUTH_ISSUER: issuer,
    ORCA_RELAY_JWKS_URL: `http://127.0.0.1:${port}${JWKS_PATH}`,
    ORCA_RELAY_ADMIN_AUDIENCE: issuer,
    ORCA_RELAY_DEPLOY_SERVICE_ACCOUNT: 'disabled@relay.invalid'
  })

  return {
    config,
    bindHost: '127.0.0.1',
    registerSelfHostedAuth(app: Hono): void {
      app.get(JWKS_PATH, (context) =>
        context.json({ keys: [{ ...publicKey, kid, alg: 'ES256', use: 'sig' }] })
      )
      app.post(AUTH_PATH + '/token', async (context) => {
        const bearer = readBearer(context.req.header('authorization'))
        if (!bearer || !timingSafeEqual(tokenDigest, createHash('sha256').update(bearer).digest())) {
          return context.json({ error: 'invalid_token' }, 401)
        }
        const request = HostRequest.safeParse(await context.req.json().catch(() => null))
        if (!request.success) return context.json({ error: 'invalid_host' }, 400)
        const { relayHostId, hostPublicKeyB64 } = request.data
        const key = Buffer.from(hostPublicKeyB64, 'base64')
        if (
          key.toString('base64') !== hostPublicKeyB64 ||
          createHash('sha256').update(key).digest('base64url').slice(0, 16) !== relayHostId
        ) {
          return context.json({ error: 'invalid_host' }, 400)
        }
        const expiresAt = (Math.floor(Date.now() / 1000) + 15 * 60) * 1000
        const relayToken = await new SignJWT({ prof: issuer, relayHostId, purpose: 'host-control' })
          .setProtectedHeader({ alg: 'ES256', kid })
          .setSubject('self-hosted')
          .setIssuer(issuer)
          .setAudience(config.authAudience)
          .setIssuedAt()
          .setExpirationTime(expiresAt / 1000)
          .sign(signingKey)
        context.header('Cache-Control', 'no-store')
        return context.json({ relayToken, expiresAt })
      })
    }
  }
}
