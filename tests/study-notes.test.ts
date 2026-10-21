import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudyNoteFiles } from '@/lib/study-note-files';
import { noteBodySchema, notePathSchema } from '@/lib/study-note-format';

const directories: string[] = [];
const scope = { userId: 'owner', courseId: 'course', sessionId: 'session' };
const body =
  '# Closures\n\nA function retains its lexical environment.\n\n### Key Points\n- Scope follows declaration.\n\n### Example\n```javascript\nconst outer = () => () => 1;\nconsole.log(outer()());\n```\n\n### Output\n```text\n1\n```\n\n### Reference\nhttps://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures\n';
afterEach(async () => {
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
async function store() {
  const directory = await mkdtemp(join(tmpdir(), 'study-notes-test-'));
  directories.push(directory);
  return new StudyNoteFiles(directory);
}
describe('per-session Markdown file storage', () => {
  it('stores independent files in topic folders, updates in place, and retains LF text', async () => {
    const files = await store();
    const version = await files.save(
      scope,
      'javascript/closures.md',
      body.replace(/\n/g, '\r\n'),
      '',
    );
    await files.save(
      scope,
      'javascript/functions.md',
      body.replace('# Closures', '# Functions'),
      '',
    );
    expect(
      await readFile(join(files.sessionDirectory(scope), 'javascript/closures.md'), 'utf8'),
    ).toBe(body);
    expect((await files.list(scope)).map((note) => note.path)).toEqual([
      'javascript/closures.md',
      'javascript/functions.md',
    ]);
    await files.save(
      scope,
      'javascript/closures.md',
      body.replace('Scope follows declaration.', 'Lexical scope follows declaration.'),
      version,
    );
    expect(await files.list(scope)).toHaveLength(2);
    expect((await files.read(scope, 'javascript/closures.md'))?.body).toContain('Lexical scope');
    expect(await files.hasCourseNotes(scope)).toBe(true);
  });
  it('prevents duplicate creation and stale edits or deletes', async () => {
    const files = await store();
    const version = await files.save(scope, 'closures.md', body, '');
    await expect(files.save(scope, 'closures.md', 'overwrite', '')).rejects.toThrow(
      'already exists',
    );
    const latest = await files.save(
      scope,
      'closures.md',
      body + '\nAn extra paragraph.\n',
      version,
    );
    await expect(files.save(scope, 'closures.md', body, version)).rejects.toThrow('changed');
    await expect(files.remove(scope, 'closures.md', version)).rejects.toThrow('changed');
    await files.remove(scope, 'closures.md', latest);
    expect(await files.list(scope)).toEqual([]);
  });
  it('isolates owners and sessions and removes only the requested scope', async () => {
    const files = await store();
    await files.save(scope, 'closures.md', body, '');
    const otherSession = { ...scope, sessionId: 'another-session' };
    await files.save(otherSession, 'closures.md', body, '');
    expect(await files.read({ ...scope, userId: 'another-owner' }, 'closures.md')).toBeNull();
    await files.removeSession(scope);
    expect(await files.list(scope)).toEqual([]);
    expect(await files.list(otherSession)).toHaveLength(1);
    await files.removeCourse(scope);
    expect(await files.hasCourseNotes(scope)).toBe(false);
  });
  it.each([
    '../secret.md',
    '/tmp/secret.md',
    'javascript/../../secret.md',
    'topic\\secret.md',
    'topic/%2e%2e/secret.md',
    'Uppercase.md',
    'file.txt',
    'topic/.hidden.md',
    'a/b/c/d/e.md',
  ])('rejects unsafe or nonstandard path %s', async (path) => {
    const files = await store();
    expect(notePathSchema.safeParse(path).success).toBe(false);
    await expect(files.save(scope, path, body, '')).rejects.toThrow();
  });
});
describe('study-note structure', () => {
  it('accepts concise Markdown with a separately fenced output and direct source', () =>
    expect(noteBodySchema.safeParse(body).success).toBe(true));
  it('rejects missing sources, unlabeled fences, and headings hidden in code', () => {
    expect(noteBodySchema.safeParse(body.replace('```javascript', '```')).success).toBe(false);
    expect(
      noteBodySchema.safeParse(
        body.replace(
          'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures',
          'A link I made up',
        ),
      ).success,
    ).toBe(false);
    expect(
      noteBodySchema.safeParse(
        '# Title\n\n```text\n### Key Points\n### Example\n### Reference\nhttps://example.com\n```',
      ).success,
    ).toBe(false);
  });
});
