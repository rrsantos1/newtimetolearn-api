import { z } from "zod";
import { TeacherStudentStatus } from "../types/TeacherStudentStatus";

export const listRelationshipsSchema = z.object({
  status: z.enum(TeacherStudentStatus).optional(),
});

export type ListRelationshipsInput = z.infer<typeof listRelationshipsSchema>;
