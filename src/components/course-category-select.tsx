import { courseCategoryGroups, isCourseCategory } from '@/lib/course-categories';

export function CourseCategorySelect({
  value,
  languagesOnly = false,
}: {
  value?: string;
  languagesOnly?: boolean;
}) {
  return (
    <select
      name="category"
      aria-label={languagesOnly ? 'Language' : 'Category'}
      required
      defaultValue={value ?? ''}
    >
      <option value="" disabled>
        Choose a category
      </option>
      {value &&
        (!isCourseCategory(value) ||
          (languagesOnly &&
            !courseCategoryGroups[1].categories.some((category) => category === value))) && (
          <option value={value}>{value} (existing category)</option>
        )}
      {courseCategoryGroups
        .filter((group) => !languagesOnly || group.label === 'Language learning')
        .map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </optgroup>
        ))}
    </select>
  );
}
