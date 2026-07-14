export type FormState = {
  message?: string;
  errors?: Record<string, string[]>;
  status?: "info" | "warning" | "error" | "success";
};
