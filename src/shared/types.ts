export type User = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "user";
  active: boolean;
};

export type CalendarDay = {
  date: string;
  isToday: boolean;
  isCurrentMonth: boolean;
  availableUserIds: number[];
  availableNames: string[];
  availableCount: number;
  participantCount: number;
  allAvailable: boolean;
  currentUserAvailable: boolean;
};

export type CalendarMonth = {
  label: string;
  year: number;
  month: number;
  days: CalendarDay[];
};

export type CalendarResponse = {
  months: CalendarMonth[];
  participants: Pick<User, "id" | "name" | "email">[];
};
