import type { CommandSpec } from '../discovery/command-spec'
import { CLI_GLOBAL_FLAGS as GLOBAL_FLAGS } from '../../shared/cli/cli-argument-boundary'

export const PAIR_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['pair'],
    summary:
      'Pair a phone or another Orca with the Orca already running here, without restarting it',
    usage:
      'orca pair [--mobile [--relay] | --loopback] [--address <endpoint>] [--grant-desktop-control] [--rotate] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'mobile',
      'relay',
      'address',
      'loopback',
      'grant-desktop-control',
      'rotate'
    ],
    notes: [
      'Asks the Orca running for this profile (desktop app, `orca serve`, or its service) for a pairing offer. Nothing restarts and existing clients stay connected.',
      'Without --mobile it prints an access link for another Orca (Settings → Remote Orca Servers → Add Server). --mobile prints a QR code and link for Orca Mobile.',
      '--address sets the hostname, IP, or WebSocket URL the client should use. Include a port if it differs from the server port.',
      '--loopback creates an access link for localhost or an SSH tunnel without opening the server to the network. It defaults to 127.0.0.1 at the server port.',
      'The first network pairing makes a loopback-only Orca listen on every interface, as pairing from the desktop app does.',
      'Mobile pairing is LAN-only (same network or tailnet) unless --relay is given; Relay needs this host’s Orca signed in (`orca auth login`).',
      'An unused offer is reused until --rotate replaces it. After Orca restarts it can’t be printed again, so a new one is made and the earlier link keeps working until --rotate. Clients that already paired keep their access.',
      "--grant-desktop-control lets Orca drive this machine's desktop (orca computer) for the paired Orca. Off, Orca won't do it for the client; anything with a terminal here can. It applies only to an access link, not to a phone.",
      'Paired clients and phones can’t create offers through Orca, but anything with a terminal here can. Revoking a paired client also revokes links made from terminals it opened.'
    ],
    examples: [
      'orca pair --mobile',
      'orca pair --mobile --address 100.64.1.20',
      'orca pair --address 100.64.1.20',
      'orca pair --loopback --address ws://127.0.0.1:16800',
      'orca pair --mobile --rotate --json'
    ]
  }
]
