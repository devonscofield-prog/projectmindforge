import { useState, useEffect, useCallback, useRef } from 'react';

const DRAFT_PREFIX = 'form_draft_';
const AUTOSAVE_INTERVAL = 30000; // 30 seconds

interface UseFormDraftOptions<T> {
  key: string;
  initialValues: T;
  /** Fields to include in dirty check - if undefined, all fields are checked */
  dirtyFields?: (keyof T)[];
}

interface UseFormDraftReturn<T> {
  values: T;
  setValues: React.Dispatch<React.SetStateAction<T>>;
  isDirty: boolean;
  hasDraft: boolean;
  restoreDraft: () => void;
  discardDraft: () => void;
  clearDraft: () => void;
}

export function useFormDraft<T extends Record<string, unknown>>({
  key,
  initialValues,
  dirtyFields,
}: UseFormDraftOptions<T>): UseFormDraftReturn<T> {
  const storageKey = `${DRAFT_PREFIX}${key}`;
  const [values, setValues] = useState<T>(initialValues);
  const [hasDraft, setHasDraft] = useState(false);
  const initialValuesRef = useRef(initialValues);

  // Check for existing draft on mount
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(storageKey);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        // Validate draft has data
        if (parsed && typeof parsed === 'object') {
          setHasDraft(true);
        }
      }
    } catch {
      // Invalid draft, ignore
    }
  }, [storageKey]);

  // Calculate if form is dirty
  const isDirty = useCallback(() => {
    const fieldsToCheck = dirtyFields || (Object.keys(values) as (keyof T)[]);
    return fieldsToCheck.some((field) => {
      const current = values[field];
      const initial = initialValuesRef.current[field];
      if (Array.isArray(current) && Array.isArray(initial)) {
        return current.length !== initial.length || 
          JSON.stringify(current) !== JSON.stringify(initial);
      }
      return current !== initial;
    });
  }, [values, dirtyFields]);

  // Autosave draft periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (isDirty()) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(values));
        } catch {
          // Storage full or unavailable
        }
      }
    }, AUTOSAVE_INTERVAL);

    return () => clearInterval(interval);
  }, [values, storageKey, isDirty]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty()) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const restoreDraft = useCallback(() => {
    try {
      const savedDraft = localStorage.getItem(storageKey);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft) as T;
        setValues(parsed);
        setHasDraft(false);
      }
    } catch {
      // Invalid draft
    }
  }, [storageKey]);

  const discardDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignore errors
    }
    setHasDraft(false);
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignore errors
    }
    setHasDraft(false);
  }, [storageKey]);

  return {
    values,
    setValues,
    isDirty: isDirty(),
    hasDraft,
    restoreDraft,
    discardDraft,
    clearDraft,
  };
}
