export const NotificationType = {
  TEACHER_STUDENT_INVITATION: "TEACHER_STUDENT_INVITATION",
} as const;

export type NotificationTypeCode =
  (typeof NotificationType)[keyof typeof NotificationType];
