import { describe, it, expect } from 'vitest';
import {
  generateSchedule,
  progress,
  scoreExam,
  canSeeCourse,
  canSeeProgress,
  canSeeScores,
  ownsResource,
  grade,
} from '../src/lib/learning';
import { courseSchema, profileSchema, examSchema, sessionSchema } from '../src/lib/validation';
import { formatInTimeZone } from 'date-fns-tz';
const schedule = {
  startDate: '2026-10-01',
  scheduledTime: '18:00',
  timezone: 'Asia/Tehran',
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  totalSessions: 25,
};
describe('Scheduling', () => {
  it('generates exactly the configured count at Tehran local time', () => {
    const dates = generateSchedule(schedule);
    expect(dates).toHaveLength(25);
    expect(dates[0].toISOString()).toBe('2026-10-01T14:30:00.000Z');
    expect(formatInTimeZone(dates[24], 'Asia/Tehran', 'yyyy-MM-dd HH:mm')).toBe('2026-10-25 18:00');
  });
  it('uses selected weekdays and preserves local class time across DST', () => {
    const dates = generateSchedule({
      ...schedule,
      startDate: '2026-03-06',
      scheduledTime: '18:00',
      timezone: 'America/New_York',
      weekdays: [1, 5],
      totalSessions: 3,
    });
    expect(dates.map((d) => formatInTimeZone(d, 'America/New_York', 'EEE HH:mm'))).toEqual([
      'Fri 18:00',
      'Mon 18:00',
      'Fri 18:00',
    ]);
    expect(dates[0].getUTCHours()).toBe(23);
    expect(dates[1].getUTCHours()).toBe(22);
  });
  it('rejects times inside a daylight saving gap', () =>
    expect(() =>
      generateSchedule({
        ...schedule,
        startDate: '2026-03-08',
        scheduledTime: '02:30',
        timezone: 'America/New_York',
        totalSessions: 1,
      }),
    ).toThrow('daylight saving gap'));
});
describe('Progress', () => {
  it('counts completed sessions, not skipped ones', () =>
    expect(
      progress([
        { status: 'completed' },
        { status: 'skipped' },
        { status: 'upcoming' },
        { status: 'in_progress' },
      ]),
    ).toEqual({ completed: 1, total: 4, remaining: 3, percentage: 25 }));
  it('handles an empty university', () => expect(progress([]).percentage).toBe(0));
});
const questions = [
  {
    id: 'q1',
    question: 'Block scoped?',
    points: 2,
    explanation: 'let',
    options: [
      { id: 'a', text: 'let', isCorrect: true },
      { id: 'b', text: 'var', isCorrect: false },
    ],
  },
  {
    id: 'q2',
    question: 'Closures retain scope?',
    points: 1,
    explanation: 'Yes',
    options: [
      { id: 'c', text: 'True', isCorrect: true },
      { id: 'd', text: 'False', isCorrect: false },
    ],
  },
];
describe('Scoring', () => {
  it('uses weighted points and treats unanswered questions as incorrect', () => {
    const result = scoreExam(questions, { q1: 'a' }, 70);
    expect(result.score).toBe(2);
    expect(result.maxScore).toBe(3);
    expect(result.percentage).toBe(66.67);
    expect(result.passed).toBe(false);
    expect(result.review[1].selected).toBeNull();
  });
  it('does not credit an option belonging to another question', () =>
    expect(scoreExam(questions, { q1: 'c', q2: 'a' }, 70).score).toBe(0));
  it('passes at the exact threshold and ignores unknown question keys', () =>
    expect(scoreExam(questions, { q1: 'a', q2: 'c', fake: 'a' }, 100).passed).toBe(true));
  it('does not round up across a passing threshold', () => {
    const qs = Array.from({ length: 200 }, (_, i) => ({
      ...questions[0],
      id: String(i),
      points: 1,
    }));
    const answers = Object.fromEntries(qs.slice(0, 139).map((q) => [q.id, 'a']));
    const r = scoreExam(qs, answers, 70);
    expect(r.percentage).toBe(69.5);
    expect(r.passed).toBe(false);
  });
  it('requires a valid answer key', () =>
    expect(() => scoreExam([{ ...questions[0], options: [] }], {}, 70)).toThrow('answer key'));
  it('calculates grades', () =>
    expect([95, 85, 75, 65, 55].map(grade)).toEqual(['A', 'B', 'C', 'D', 'F']));
});
describe('Privacy and ownership', () => {
  for (const publicProfile of [false, true])
    for (const publicProgress of [false, true])
      for (const showCourses of [false, true])
        for (const showExamScores of [false, true])
          for (const isPublic of [false, true]) {
            it(`enforces privacy combination ${[publicProfile, publicProgress, showCourses, showExamScores, isPublic].join('/')}`, () => {
              const user = { publicProfile, publicProgress, showCourses, showExamScores };
              expect(canSeeCourse(user, { isPublic })).toBe(
                publicProfile && showCourses && isPublic,
              );
              expect(canSeeProgress(user)).toBe(publicProfile && publicProgress);
              expect(canSeeScores(user)).toBe(publicProfile && publicProgress && showExamScores);
            });
          }
  it('requires the same owner', () => {
    expect(ownsResource('alice', 'bob')).toBe(false);
    expect(ownsResource('alice', 'alice')).toBe(true);
  });
});
describe('Input validation', () => {
  it('validates a course including timezone and weekdays', () => {
    const input = {
      ...schedule,
      title: 'JS',
      description: '',
      category: 'Web',
      difficulty: 'advanced',
      color: 'teal',
      duration: 60,
      isPublic: false,
    };
    expect(courseSchema.safeParse(input).success).toBe(true);
    expect(courseSchema.safeParse({ ...input, timezone: 'Nonsense/Bad' }).success).toBe(false);
    expect(courseSchema.safeParse({ ...input, weekdays: [] }).success).toBe(false);
    expect(courseSchema.safeParse({ ...input, totalSessions: 0 }).success).toBe(false);
  });
  it('rejects invalid dates and unsafe profile URLs', () => {
    expect(
      sessionSchema.safeParse({
        title: 'Class',
        description: '',
        date: '2026-02-30',
        time: '18:00',
        duration: 60,
        notes: '',
        status: 'upcoming',
      }).success,
    ).toBe(false);
    const profile = {
      name: 'Keyvan',
      username: 'keyvan',
      bio: '',
      location: '',
      website: 'javascript:alert(1)',
      githubUrl: '',
      linkedinUrl: '',
      timezone: 'Asia/Tehran',
      publicProfile: true,
      publicProgress: true,
      showCourses: true,
      showExamScores: false,
    };
    expect(profileSchema.safeParse(profile).success).toBe(false);
    expect(profileSchema.safeParse({ ...profile, website: 'https://jsfather.ir' }).success).toBe(
      true,
    );
  });
  it('requires exactly one correct option', () => {
    const exam = {
      title: 'Final exam',
      description: '',
      passingScore: 70,
      timeLimit: 30,
      published: true,
      questions: [
        {
          question: 'Valid question?',
          type: 'multiple_choice',
          points: 1,
          explanation: '',
          options: [
            { text: 'A', isCorrect: true },
            { text: 'B', isCorrect: true },
          ],
        },
      ],
    };
    expect(examSchema.safeParse(exam).success).toBe(false);
  });
});
