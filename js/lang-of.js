// Bahasa komunikasi bagi seorang pelajar: tetapan pelajar -> pilihan akaun ibu bapa -> null (guna bahasa semasa).
import { S } from './data.js';
export const langOf = st => st?.lang || (S.t.profiles || []).find(p => p.id === st?.guardian_id)?.lang || null;
export const langOfStudentId = id => langOf((S.t.students || []).find(s => s.id === id));
