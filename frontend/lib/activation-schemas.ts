import { z } from "zod";
import {
  isCompleteMxNumber,
  isValidMxE164,
  normalizeToMxE164,
} from "./mx-phone";

export const activateSchema = z.object({
  activationCode: z
    .string()
    .trim()
    .min(1, "El codigo de activacion es obligatorio")
    .refine(
      (value) => /^(SOS-[A-F0-9]{4}-[A-F0-9]{4}|[A-F0-9]{8}|[A-F0-9]{32})$/.test(value.toUpperCase()),
      "Formato SOS-XXXX-XXXX, 8 hex o 32 hex",
    ),
  email: z.string().email("Ingresa un email valido"),
  password: z
    .string()
    .min(8, "La contrasena debe tener al menos 8 caracteres"),
});

export const basicDataSchema = z.object({
  firstName: z.string().min(2, "Nombre requerido"),
  lastName: z.string().min(2, "Apellidos requeridos"),
  phoneNumber: z
    .string()
    .transform((value) => normalizeToMxE164(value))
    .superRefine((value, context) => {
      if (!isCompleteMxNumber(value)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Número telefónico incompleto para México",
        });
        return;
      }

      if (!isValidMxE164(value)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Telefono invalido",
        });
      }
    }),
});

export const verifySmsSchema = z.object({
  code: z.string().length(6, "El codigo debe tener 6 digitos").regex(/^\d{6}$/),
});

export type ActivateValues = z.infer<typeof activateSchema>;
export type BasicDataValues = z.infer<typeof basicDataSchema>;
export type VerifySmsValues = z.infer<typeof verifySmsSchema>;
