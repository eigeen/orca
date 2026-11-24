import type * as WorktreeScanCacheModule from '../../../git/worktrees/catalog/worktree-scan-cache'
import type * as WorktreeListingModule from '../../../git/worktrees/catalog/worktree-listing'
import '../dispatch/testing/unused-default-rpc-methods.test-fixture'
import { cpSync, mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { OrcaRuntimeService } from '../../orca-runtime'
import { OrcaRuntimeRpcServer } from './runtime-rpc'
import { parsePairingCode } from '../../../../shared/remote-runtime/pairing/pairing'
import { createOwnerPairingOffer } from './pairing/pairing-offer-requests'
import { DEVICE_REGISTRY_FILENAME } from './pairing/mobile-pairing-files'
import '../../../../shared/remote-runtime/host-store/runtime-e2ee-keypair-file'
import '../methods/host-management/status'

vi.mock('../../../git/worktrees/catalog/worktree-scan-cache', async (importOriginal) => {
  const listings = getWorktreeListingMocks()
  return {
    ...(await importOriginal<typeof WorktreeScanCacheModule>()),
    listWorktrees: listings.listWorktrees
  }
})

vi.mock('../../../git/worktrees/catalog/worktree-listing', async (importOriginal) => {
  const listings = getWorktreeListingMocks()
  return {
    ...(await importOriginal<typeof WorktreeListingModule>()),
    listWorktreesStrict: listings.listWorktreesStrict
  }
})

const { getWorktreeListingMocks } = vi.hoisted(() => {
  function createWorktreeListingMocks() {
    const worktrees = [
      {
        path: '/tmp/worktree-a',
        head: 'abc',
        branch: 'feature/foo',
        isBare: false,
        isMainWorktree: false
      }
    ]
    return {
      listWorktrees: vi.fn().mockResolvedValue(worktrees),
      listWorktreesStrict: vi.fn().mockResolvedValue(worktrees)
    }
  }
  let listings: ReturnType<typeof createWorktreeListingMocks> | undefined
  return { getWorktreeListingMocks: () => (listings ??= createWorktreeListingMocks()) }
})

describe('OrcaRuntimeRpcServer', () => {
  it('offers an SSH tunnel port without changing a loopback listener or reusing a network link', async () => {
    const userDataPath = mkdtempSync(join(tmpdir(), 'orca-runtime-rpc-'))
    const server = new OrcaRuntimeRpcServer({
      methods: [],
      runtime: new OrcaRuntimeService(),
      userDataPath,
      enableWebSocket: true,
      wsPort: 0,
      pinnedBindHost: '127.0.0.1'
    })

    await server.start()
    try {
      const listenEndpoint = server.getWebSocketEndpoint()
      const network = server.createPairingOffer({
        address: '192.168.1.249',
        scope: 'runtime',
        reach: 'network'
      })
      if (!network.available) {
        throw new Error('Could not seed the pending network link')
      }

      const offer = await createOwnerPairingOffer(server, {
        scope: 'runtime',
        reach: 'this-computer',
        address: 'ws://127.0.0.1:16800'
      })
      if (!offer.available) {
        throw new Error(offer.reason)
      }
      expect(parsePairingCode(offer.pairingUrl)?.endpoint).toBe('ws://127.0.0.1:16800')
      expect(offer.deviceId).not.toBe(network.deviceId)
      expect(server.getWebSocketEndpoint()).toBe(listenEndpoint)

      const invalid = await createOwnerPairingOffer(server, {
        scope: 'runtime',
        reach: 'this-computer',
        address: 'ws://192.168.1.249:16800'
      })
      expect(invalid).toMatchObject({ available: false, reason: 'invalid_advertised_endpoint' })
      expect(server.getWebSocketEndpoint()).toBe(listenEndpoint)
    } finally {
      await server.stop()
    }
  })

  it('gives a copy started with another ORCA_INSTANCE_ID its own key and drops copied tokens', async () => {
    const pairingFrom = async (userDataPath: string, instanceId: string) => {
      vi.stubEnv('ORCA_INSTANCE_ID', instanceId)
      const server = new OrcaRuntimeRpcServer({
        methods: [],
        runtime: new OrcaRuntimeService(),
        userDataPath,
        enableWebSocket: true,
        wsPort: 0
      })
      await server.start()
      const offer = server.createPairingOffer({ name: 'Clone test' })
      return { server, parsed: offer.available ? parsePairingCode(offer.pairingUrl) : null }
    }
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const source = mkdtempSync(join(tmpdir(), 'orca-runtime-rpc-'))
    const clone = mkdtempSync(join(tmpdir(), 'orca-runtime-rpc-'))
    try {
      const original = await pairingFrom(source, 'vm-a')
      await original.server.stop()
      const sourceToken = original.parsed?.deviceToken ?? ''
      expect(sourceToken).toBeTruthy()
      cpSync(source, clone, { recursive: true })

      const cloned = await pairingFrom(clone, 'vm-b')
      expect(cloned.parsed?.publicKeyB64).toBeTruthy()
      expect(cloned.parsed?.publicKeyB64).not.toBe(original.parsed?.publicKeyB64)
      expect(cloned.server.getDeviceRegistry()?.validateToken(sourceToken)).toBeNull()
      await cloned.server.stop()

      const restarted = await pairingFrom(source, 'vm-a')
      expect(restarted.parsed?.publicKeyB64).toBe(original.parsed?.publicKeyB64)
      expect(restarted.server.getDeviceRegistry()?.validateToken(sourceToken)).not.toBeNull()
      await restarted.server.stop()
    } finally {
      vi.unstubAllEnvs()
      errorSpy.mockRestore()
    }
  })

  it('reports a registry persistence failure without retaining a ghost credential', async () => {
    const userDataPath = mkdtempSync(join(tmpdir(), 'orca-runtime-rpc-'))
    const server = new OrcaRuntimeRpcServer({
      methods: [],
      runtime: new OrcaRuntimeService(),
      userDataPath,
      enableWebSocket: true,
      wsPort: 0
    })
    await server.start()
    mkdirSync(join(userDataPath, DEVICE_REGISTRY_FILENAME))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      expect(server.createPairingOffer({ name: 'Registry failure test' })).toMatchObject({
        available: false,
        reason: 'device_registry_unavailable',
        guidance: expect.any(String)
      })
      expect(server.getDeviceRegistry()?.listDevices()).toHaveLength(0)
    } finally {
      errorSpy.mockRestore()
      await server.stop()
    }
  })
})
