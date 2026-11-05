export const NotificationType = {
  TEACHER_STUDENT_INVITATION: "TEACHER_STUDENT_INVITATION",
  NOTEBOOK_DAY_PUBLISHED: "NOTEBOOK_DAY_PUBLISHED",
  NOTEBOOK_NOTE_REPLY: "NOTEBOOK_NOTE_REPLY",
} as const;

export type NotificationTypeCode =
  (typeof NotificationType)[keyof typeof NotificationType];
