import { describe, it, expect } from 'vitest';
import { bookCourseSchema, bookProgressSchema, bookBookmarkSchema } from '../src/lib/validation';
const book = {
  title: 'A 400-page book',
  description: '',
  category: 'Backend',
  difficulty: 'beginner',
  color: 'amber',
  bookAuthor: '',
  totalPages: '400',
  isPublic: false,
};
describe('Book reading inputs', () => {
  it('creates book metadata without a timetable', () => {
    expect(bookCourseSchema.parse(book).totalPages).toBe(400);
    expect(bookCourseSchema.parse({ ...book, bookAuthor: '  Author  ' }).bookAuthor).toBe('Author');
  });
  it('rejects empty, fractional and excessive page counts', () => {
    for (const totalPages of ['', '0', '-1', '4.5', '2000001'])
      expect(bookCourseSchema.safeParse({ ...book, totalPages }).success).toBe(false);
  });
  it('allows returning to an earlier page including not started, but rejects invalid positions', () => {
    expect(bookProgressSchema.parse({ currentPage: '0' }).currentPage).toBe(0);
    expect(bookProgressSchema.parse({ currentPage: '100' }).currentPage).toBe(100);
    expect(bookProgressSchema.safeParse({ currentPage: '-1' }).success).toBe(false);
    expect(bookProgressSchema.safeParse({ currentPage: '1.5' }).success).toBe(false);
  });
  it('supports page bookmarks with optional labels and notes', () => {
    expect(bookBookmarkSchema.parse({ page: '150', label: '', notes: '' }).page).toBe(150);
    expect(bookBookmarkSchema.safeParse({ page: '0', label: '', notes: '' }).success).toBe(false);
    expect(
      bookBookmarkSchema.safeParse({ page: '1', label: '', notes: 'n'.repeat(10001) }).success,
    ).toBe(false);
  });
});
