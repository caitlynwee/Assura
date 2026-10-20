import type { UserProfile } from "./types";

export function ageFromDateOfBirth(dateOfBirth: string, today = new Date()): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  if (!match) return undefined;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  let age = today.getFullYear() - year;
  const birthdayHasPassed =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!birthdayHasPassed) age -= 1;
  return age;
}

export function profileAge(profile: UserProfile, today = new Date()): number | undefined {
  if (profile.dateOfBirth) return ageFromDateOfBirth(profile.dateOfBirth, today);
  return profile.age;
}

export function dateOfBirthInputBounds(today = new Date()) {
  const format = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const latest = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  const earliest = new Date(today.getFullYear() - 80, today.getMonth(), today.getDate());
  return { min: format(earliest), max: format(latest) };
}
