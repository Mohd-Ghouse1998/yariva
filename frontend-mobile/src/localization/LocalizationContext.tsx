import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  translate,
  type AppLanguage,
  type CopyTone,
  type TranslationParams,
} from "./translate";

export type { AppLanguage, CopyTone } from "./translate";

const LANGUAGE_KEY = "yariva.language";
const TONE_KEY = "yariva.copyTone";

interface LocalizationValue {
  language: AppLanguage;
  tone: CopyTone;
  setLanguage: (language: AppLanguage) => void;
  setTone: (tone: CopyTone) => void;
  t: (key: string, params?: TranslationParams) => string;
}

const LocalizationContext = createContext<LocalizationValue | null>(null);

const deviceLanguage = (): AppLanguage => {
  const languageCode = getLocales()[0]?.languageCode;
  return languageCode === "hi" || languageCode === "te" ? languageCode : "en";
};

export const LocalizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>(deviceLanguage);
  const [tone, setToneState] = useState<CopyTone>("standard");

  useEffect(() => {
    void Promise.all([AsyncStorage.getItem(LANGUAGE_KEY), AsyncStorage.getItem(TONE_KEY)]).then(
      ([savedLanguage, savedTone]) => {
        if (savedLanguage === "en" || savedLanguage === "hi" || savedLanguage === "te") {
          setLanguageState(savedLanguage);
        }
        if (savedTone === "standard" || savedTone === "hyderabad-casual") {
          setToneState(savedTone);
        }
      },
    );
  }, []);

  const value = useMemo<LocalizationValue>(() => {
    const setLanguage = (next: AppLanguage) => {
      setLanguageState(next);
      void AsyncStorage.setItem(LANGUAGE_KEY, next);
    };
    const setTone = (next: CopyTone) => {
      setToneState(next);
      void AsyncStorage.setItem(TONE_KEY, next);
    };
    const t = (key: string, params?: TranslationParams) =>
      translate(language, tone, key, params);
    return { language, tone, setLanguage, setTone, t };
  }, [language, tone]);

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
};

export const useLocalization = (): LocalizationValue => {
  const value = useContext(LocalizationContext);
  if (!value) throw new Error("useLocalization must be used inside LocalizationProvider");
  return value;
};
