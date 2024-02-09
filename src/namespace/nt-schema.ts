import { Endpoint } from '@ndn/endpoint';
import { Data, Interest, Name, type Verifier } from '@ndn/packet';
// import * as namePattern from './name-pattern.ts';
import * as schemaTree from './schema-tree.ts';
import { type BaseNode } from './base-node.ts';

export enum VerifyResult {
  Fail = -2,
  Timeout = -1,
  Unknown = 0,
  Pass = 1,
  Bypass = 2,
  CachedData = 3,
}

export interface NamespaceHandler {
  get endpoint(): Endpoint;
  getVerifier(deadline: number): Verifier;
  storeData(data: Data): Promise<void>;
}

export class NtSchema implements NamespaceHandler {
  public readonly tree = schemaTree.create<BaseNode>();
  protected _endpoint: Endpoint | undefined;
  protected _attachedPrefix: Name | undefined;

  get endpoint(): Endpoint {
    return this._endpoint!;
  }

  public match(name: Name) {
    if (!this._attachedPrefix?.isPrefixOf(name)) {
      return undefined;
    }
    const prefixLength = this._attachedPrefix!.length;
    return schemaTree.match(this.tree, name.slice(prefixLength));
  }

  public getVerifier(deadline: number): Verifier {
    return {
      verify: async (pkt: Verifier.Verifiable) => {
        const matched = this.match(pkt.name);
        if (!matched || !matched.resource) {
          throw new Error('Unexpected packet');
        }
        if (!await schemaTree.call(matched, 'verifyPacket', pkt, deadline)) {
          throw new Error('Unverified packet');
        }
      },
    };
  }

  public async storeData(data: Data): Promise<void> {
    const matched = this.match(data.name);
    if (matched && matched.resource) {
      await schemaTree.call(matched, 'storeData', data);
    }
  }

  public async onInterest(interest: Interest): Promise<Data | undefined> {
    const matched = this.match(interest.name);
    if (matched && matched.resource) {
      return await schemaTree.call(matched, 'processInterest', interest, Date.now() + interest.lifetime);
    }
    return undefined;
  }

  // TODO: schemaTree.traverse
  // public async attach(prefix: Name, endpoint: Endpoint) {
  // }

  // public async detach() {
  // }
}