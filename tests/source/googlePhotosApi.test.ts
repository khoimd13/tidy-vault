import { describe, expect, it } from 'vitest';
import {
  addPhotosToNewAlbum,
  buildRequest,
  parseReply,
  readSession,
  type Session,
} from '../../src/source/googlePhotosApi';

const SESSION: Session = { at: 'AT:tok', sid: '-123', bl: 'boq_photos_1', path: '/_/PhotosUi/' };

/** A batchexecute-style reply carrying `payload`. */
function reply(rpcid: string, payload: unknown): string {
  return `)]}'\n\n123\n${JSON.stringify([['wrb.fr', rpcid, JSON.stringify(payload), null, null, null, 'generic']])}\n`;
}

describe('readSession', () => {
  it('reads the values from the inline WIZ_global_data script', () => {
    const html = `window.WIZ_global_data = {"SNlM0e":"AT\\u003dtok","FdrFJe":"-123","cfb2h":"boq_photos_1","eptZe":"/_/PhotosUi/","other":1};`;
    expect(readSession(['var x = 1;', html])).toEqual({ ...SESSION, at: 'AT=tok' });
  });
  it('fails clearly when Google changes the page', () => {
    expect(() => readSession(['nothing here'])).toThrow(/SNlM0e/);
  });
});

describe('buildRequest and parseReply', () => {
  it('builds a batchexecute request', () => {
    const { url, body } = buildRequest(SESSION, 'OXvT9d', ['name', null, 2], '/');
    expect(url).toMatch(
      /^https:\/\/photos\.google\.com\/_\/PhotosUi\/data\/batchexecute\?rpcids=OXvT9d/,
    );
    expect(url).toContain('f.sid=-123');
    expect(decodeURIComponent(body)).toContain(
      '[[["OXvT9d","[\\"name\\",null,2]",null,"generic"]]]',
    );
    expect(body).toContain(`at=${encodeURIComponent('AT:tok')}`);
  });
  it('parses the payload and rejects odd replies', () => {
    expect(parseReply(reply('x', [['key']]))).toEqual([['key']]);
    expect(() => parseReply('<html>')).toThrow();
    expect(() => parseReply(`${JSON.stringify([['wrb.fr', 'x', null]])}`)).toThrow(/refused/);
  });
});

describe('addPhotosToNewAlbum', () => {
  const keys = Array.from({ length: 120 }, (_, i) => `AF1QipKey${String(i).padStart(4, '0')}`);

  function fakeGoogle() {
    const calls: { rpcid: string; data: unknown }[] = [];
    const fetcher = (url: string, init: RequestInit) => {
      const rpcid = new URL(url).searchParams.get('rpcids') ?? '';
      const body = typeof init.body === 'string' ? init.body : '';
      const freq = decodeURIComponent(body.split('&')[0]?.slice(6) ?? '');
      const data = JSON.parse((JSON.parse(freq) as string[][][])[0]?.[0]?.[1] ?? 'null') as unknown;
      calls.push({ rpcid, data });
      const payload =
        rpcid === 'OXvT9d'
          ? [['AF1QipAlbumKey0001']]
          : rpcid === 'snAcKc'
            ? [null, [], null, Object.assign(new Array(22).fill(null), { 21: 120 })]
            : [];
      return Promise.resolve(new Response(reply(rpcid, payload)));
    };
    return { calls, fetcher };
  }

  it('creates one album, adds photos in batches of 50 and checks the count', async () => {
    const { calls, fetcher } = fakeGoogle();
    const progress: number[] = [];
    const result = await addPhotosToNewAlbum('Vault Tidy – to remove', [...keys, keys[0] ?? ''], {
      fetcher,
      session: SESSION,
      sourcePath: '/',
      sleep: () => Promise.resolve(),
      onProgress: (added) => progress.push(added),
    });
    expect(calls.map((c) => c.rpcid)).toEqual(['OXvT9d', 'E1Cajb', 'E1Cajb', 'E1Cajb', 'snAcKc']);
    expect(calls[0]?.data).toEqual(['Vault Tidy – to remove', null, 2]);
    expect(calls[1]?.data).toEqual([keys.slice(0, 50), 'AF1QipAlbumKey0001']);
    expect(progress).toEqual([50, 100, 120]);
    expect(result).toEqual({
      albumKey: 'AF1QipAlbumKey0001',
      name: 'Vault Tidy – to remove',
      added: 120,
      verifiedCount: 120,
    });
  });

  it('never sends anything except create, add and read', async () => {
    const { calls, fetcher } = fakeGoogle();
    await addPhotosToNewAlbum('x', keys.slice(0, 3), {
      fetcher,
      session: SESSION,
      sourcePath: '/',
      sleep: () => Promise.resolve(),
    });
    expect(new Set(calls.map((c) => c.rpcid))).toEqual(new Set(['OXvT9d', 'E1Cajb', 'snAcKc']));
  });

  it('rejects junk keys and stops if the album was not created', async () => {
    const send = { fetcher: () => Promise.resolve(new Response(reply('OXvT9d', [[null]]))) };
    const deps = { ...send, session: SESSION, sourcePath: '/', sleep: () => Promise.resolve() };
    await expect(addPhotosToNewAlbum('x', ['bad key!'], deps)).rejects.toThrow('No photos');
    await expect(addPhotosToNewAlbum('x', keys.slice(0, 2), deps)).rejects.toThrow("didn't create");
  });
});
