import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { notePathSchema, noteTitle } from './study-note-format';

export type NoteScope = { userId: string; courseId: string; sessionId: string };
export type StudyNoteFile = {
  path: string;
  title: string;
  body: string;
  version: string;
  updatedAt: string;
};
export class NoteFileError extends Error {}
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const missing = (error: unknown) => (error as NodeJS.ErrnoException)?.code === 'ENOENT';

/** Markdown files are the source of truth. Call mutations while holding the course row lock. */
export class StudyNoteFiles {
  readonly root: string;
  constructor(root = process.env.STUDY_NOTES_DIR || join(process.cwd(), 'study-notes')) {
    this.root = resolve(root);
  }
  courseDirectory(scope: Pick<NoteScope, 'userId' | 'courseId'>) {
    return join(this.root, hash(scope.userId), hash(scope.courseId));
  }
  sessionDirectory(scope: NoteScope) {
    return join(this.courseDirectory(scope), hash(scope.sessionId));
  }
  private filename(scope: NoteScope, path: string) {
    return join(this.sessionDirectory(scope), notePathSchema.parse(path));
  }
  async read(scope: NoteScope, path: string): Promise<StudyNoteFile | null> {
    const filename = this.filename(scope, path);
    try {
      const body = await readFile(filename, 'utf8');
      return {
        path,
        body,
        title: noteTitle(body),
        version: hash(body),
        updatedAt: (await stat(filename)).mtime.toISOString(),
      };
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  }
  async list(scope: NoteScope): Promise<StudyNoteFile[]> {
    const paths: string[] = [];
    const visit = async (prefix = '', depth = 0) => {
      let entries;
      try {
        entries = await readdir(join(this.sessionDirectory(scope), prefix), {
          withFileTypes: true,
        });
      } catch (error) {
        if (missing(error)) return;
        throw error;
      }
      for (const entry of entries) {
        const path = prefix + entry.name;
        if (entry.isDirectory() && depth < 3 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name))
          await visit(path + '/', depth + 1);
        else if (entry.isFile() && notePathSchema.safeParse(path).success) paths.push(path);
      }
    };
    await visit();
    const notes = await Promise.all(paths.sort().map((path) => this.read(scope, path)));
    return notes.filter((note): note is StudyNoteFile => note !== null);
  }
  async save(scope: NoteScope, path: string, body: string, expectedVersion: string) {
    const current = await this.read(scope, path);
    if (expectedVersion ? current?.version !== expectedVersion : Boolean(current)) {
      throw new NoteFileError(
        current
          ? 'This note already exists or has changed. Reopen it before saving to avoid overwriting newer work.'
          : 'This note was removed. Refresh the session before continuing.',
      );
    }
    const normalized = body.replace(/\r\n?/g, '\n').trimEnd() + '\n';
    const filename = this.filename(scope, path);
    await mkdir(dirname(filename), { recursive: true, mode: 0o700 });
    const temporary = join(dirname(filename), `.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, normalized, { flag: 'wx', mode: 0o600, flush: true });
      await rename(temporary, filename);
    } finally {
      await rm(temporary, { force: true });
    }
    return hash(normalized);
  }
  async remove(scope: NoteScope, path: string, version: string) {
    const note = await this.read(scope, path);
    if (!note || note.version !== version)
      throw new NoteFileError('This note has changed or was removed. Refresh before deleting.');
    await unlink(this.filename(scope, path));
  }
  async hasCourseNotes(scope: Pick<NoteScope, 'userId' | 'courseId'>): Promise<boolean> {
    const visit = async (directory: string): Promise<boolean> => {
      let entries;
      try {
        entries = await readdir(directory, { withFileTypes: true });
      } catch (error) {
        if (missing(error)) return false;
        throw error;
      }
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) return true;
        if (entry.isDirectory() && (await visit(join(directory, entry.name)))) return true;
      }
      return false;
    };
    return visit(this.courseDirectory(scope));
  }
  async removeSession(scope: NoteScope) {
    await rm(this.sessionDirectory(scope), { recursive: true, force: true });
  }
  async removeCourse(scope: Pick<NoteScope, 'userId' | 'courseId'>) {
    await rm(this.courseDirectory(scope), { recursive: true, force: true });
  }
}
