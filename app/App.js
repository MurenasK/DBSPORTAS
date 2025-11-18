import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect } from "react";
import Index from "./index"; // <-- your existing exported stack

export default function App() {

  useEffect(() => {
    const initDefaults = async () => {
      const defaults = [
        ['duration', '200'],
        ['frequency', '700'],
        ['server_addr', '127.0.0.1'],
        ['status', 'STATUS_NONE'],
        ['time_diff', '0'],
        ['CLASSES', '{}'],        // stringified object
        ['COUNT', '0'],
        ['DAY', '1'],
        ['PARTICIPANTS', '[]'],   // stringified array
        ['START', '0'],
        ['TITLE', ''],
        ['WWW_ID', '']
      ];

      for (let [key, value] of defaults) {
        const existing = await AsyncStorage.getItem(key);
        if (existing === null) {
          await AsyncStorage.setItem(key, value);
        }
      }
    };

    initDefaults();
  }, []);

  return <Index />;
}
