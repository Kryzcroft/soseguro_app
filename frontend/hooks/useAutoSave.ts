"use client";

import { useEffect, useRef, useState } from "react";
import { DeepPartial, FieldValues, UseFormReturn, useWatch } from "react-hook-form";

export type AutoSaveState = "idle" | "saving" | "saved" | "error";

type UseAutoSaveParams<T extends FieldValues> = {
  form: UseFormReturn<T>;
  debounceMs?: number;
  enabled?: boolean;
  onSave: (values: T, dirtyFields: DeepPartial<Record<keyof T, unknown>>) => Promise<void>;
};

export function useAutoSave<T extends FieldValues>({
  form,
  debounceMs = 2000,
  enabled = true,
  onSave,
}: UseAutoSaveParams<T>) {
  const [status, setStatus] = useState<AutoSaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useWatch({ control: form.control });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!form.formState.isDirty) {
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      try {
        setStatus("saving");
        setError(null);
        const values = form.getValues();
        await onSave(values, form.formState.dirtyFields as DeepPartial<Record<keyof T, unknown>>);
        setStatus("saved");
      } catch (saveError) {
        setStatus("error");
        setError(saveError instanceof Error ? saveError.message : "No se pudo guardar");
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [debounceMs, enabled, form, form.formState.dirtyFields, form.formState.isDirty, onSave]);

  return { status, error, setStatus };
}
