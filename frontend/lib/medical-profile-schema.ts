import { z } from "zod";
import {
  isCompleteMxNumber,
  isValidMxE164,
  MX_COUNTRY_CODE,
  normalizeToMxE164,
} from "./mx-phone";

export const emergencyContactSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  relationship: z.string().min(2, "Parentesco requerido"),
  countryCode: z.literal(MX_COUNTRY_CODE).default(MX_COUNTRY_CODE),
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

export const medicalProfileSchema = z.object({
  firstName: z.string().optional().default(""),
  lastName: z.string().optional().default(""),
  birthDate: z.string().optional().default(""),
  weightKg: z.coerce.number().min(1).max(500).optional(),
  heightCm: z.coerce.number().int().min(140).max(200).optional(),
  address: z.string().optional().default(""),
  profession: z.string().optional().default(""),
  photoUrl: z.string().optional().default(""),

  bloodType: z
    .enum([
      "A_POSITIVE",
      "A_NEGATIVE",
      "B_POSITIVE",
      "B_NEGATIVE",
      "AB_POSITIVE",
      "AB_NEGATIVE",
      "O_POSITIVE",
      "O_NEGATIVE",
    ])
    .optional(),
  allergies: z.string().optional().default(""),
  isOrganDonor: z.boolean().default(false),

  hasInsurance: z.boolean().default(false),
  insuranceName: z.string().optional().default(""),
  policyNumber: z.string().optional().default(""),

  hasChronicDiseases: z.boolean().default(false),
  chronicDiseases: z.string().optional().default(""),

  hasMedications: z.boolean().default(false),
  medications: z.string().optional().default(""),

  hasImplants: z.boolean().default(false),
  implants: z.string().optional().default(""),

  medicalUnit: z.string().optional().default(""),

  emergencyContacts: z.array(emergencyContactSchema).min(1, "Agrega al menos 1 contacto").max(3, "Maximo 3 contactos"),
});

export type MedicalProfileFormValues = z.infer<typeof medicalProfileSchema>;
