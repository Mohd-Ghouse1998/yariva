import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "../../components/ui/Toast";

interface SerializedSettingsOptions<T extends object> {
  load: () => Promise<T>;
  save: (next: T, previous: T) => Promise<T>;
  saveErrorMessage?: string;
}

/**
 * One mutation at a time, with synchronous double-tap protection, optimistic
 * feedback, rollback, and reconciliation from the server response.
 */
export const useSerializedSettings = <T extends object>({
  load,
  save,
  saveErrorMessage = "Couldn’t save that change.",
}: SerializedSettingsOptions<T>) => {
  const toast = useToast();
  const [value, setValue] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const committedRef = useRef<T | null>(null);
  const savingRef = useRef(false);
  const requestRef = useRef(0);

  const reload = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setLoadError(false);
    try {
      const loaded = await load();
      if (request !== requestRef.current) return;
      committedRef.current = loaded;
      setValue(loaded);
    } catch {
      if (request === requestRef.current) setLoadError(true);
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void reload();
    return () => {
      requestRef.current += 1;
    };
  }, [reload]);

  const update = useCallback(
    async (next: T): Promise<boolean> => {
      if (savingRef.current || !committedRef.current) return false;
      const previous = committedRef.current;
      savingRef.current = true;
      setSaving(true);
      setValue(next);
      try {
        const reconciled = await save(next, previous);
        committedRef.current = reconciled;
        setValue(reconciled);
        return true;
      } catch {
        setValue(previous);
        toast.show(saveErrorMessage, "error");
        return false;
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [save, saveErrorMessage, toast],
  );

  return { value, loading, loadError, saving, reload, update };
};
