import { config } from 'dotenv';
import postgres from 'postgres';
import awl from '../src/data/academic-word-list.json';
config({ path: '.env.local', quiet: true });
config({ quiet: true });
const requestedCourseId = process.argv
  .find((v) => v.startsWith('--course-id='))
  ?.slice('--course-id='.length);
if (!requestedCourseId || !process.env.DATABASE_URL)
  throw new Error('Provide DATABASE_URL and --course-id=<existing vocabulary course id>.');
async function main() {
  const courseId = requestedCourseId!;
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    await client.begin(async (tx) => {
      const [course] = await tx`select title, kind from courses where id=${courseId} for update`;
      if (!course || course.kind !== 'vocabulary')
        throw new Error('An existing vocabulary course is required.');
      const [{ day }] =
        await tx`select to_char(now() at time zone timezone, 'YYYY-MM-DD') as day from courses where id=${courseId}`;
      let inserted = 0;
      for (const entry of awl) {
        const result =
          await tx`insert into vocabulary_words (id,course_id,word,explanation,persian_meaning,awl_sublist,related_forms,source_url,difficulty,added_on,pronunciation_ipa,pronunciation_fa)
        values (${crypto.randomUUID()},${courseId},${entry.word},${entry.persianMeaning},${entry.persianMeaning},${entry.sublist},${tx.json(entry.relatedForms)},'https://www.eapfoundation.com/vocab/academic/awllists/','medium',${day},${entry.pronunciationIpa},${entry.pronunciationFa})
        on conflict (course_id, (lower(trim(word)))) do nothing returning id`;
        inserted += result.length;
      }
      if (process.argv.includes('--pronunciations')) {
        let updated = 0;
        for (const entry of awl) {
          const result =
            await tx`update vocabulary_words set pronunciation_ipa=case when pronunciation_ipa='' then ${entry.pronunciationIpa} else pronunciation_ipa end,
            pronunciation_fa=case when pronunciation_fa='' then ${entry.pronunciationFa} else pronunciation_fa end,
            updated_at=now()
            where course_id=${courseId} and lower(trim(word))=${entry.word} and (pronunciation_ipa='' or pronunciation_fa='') returning id`;
          updated += result.length;
        }
        console.log(
          `Added pronunciation guides to ${updated} existing families; progress preserved.`,
        );
      }
      if (process.argv.includes('--publish'))
        await tx`update courses set is_public=true,updated_at=now() where id=${courseId}`;
      console.log(
        `${course.title}: inserted ${inserted} AWL families; existing words and progress preserved.`,
      );
    });
  } finally {
    await client.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
