import React, { useEffect, useState, useRef, useMemo, useCallback} from 'react'
import { Audio } from 'expo-av';
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { View, Text, TextInput, Pressable,
         Alert, StyleSheet, TouchableOpacity,
         ActivityIndicator, ScrollView, Animated,
         Dimensions, FlatList
          } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import DBSportLogo from '../assets/images/DBSportLogo.js';
import { getCurrentTimestamp, getRecentUpdates, sendData } from './utils.js';



const Stack = createNativeStackNavigator();

const getBestFitFontSize = async (participants, containerWidth, containerHeight) => {
  const maxFontSize = 60;
  const minFontSize = 10;
  let bestFontSize = minFontSize;

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 1) {
    const fitsAll = await Promise.all(
      participants.map((participant) =>
        TextSize.measure({
          text: `${participant.NUMBER} ${participant.NAME}`,
          width: containerWidth - 20, // padding/margin
          fontSize,
          fontFamily: 'System',
        }).then(size => size.width <= containerWidth && size.height <= containerHeight)
      )
    );

    if (fitsAll.every(Boolean)) {
      bestFontSize = fontSize;
      break;
    }
  }

  return bestFontSize;
};

function StartScreen({ navigation }) {
  const handlePressDB = () => navigation.navigate('Informacijos Įvestis');

  return (
    <View style={StartStyles.container}>
      <DBSportLogo style={StartStyles.logo} />
      <TouchableOpacity style={StartStyles.button} onPress={handlePressDB}>
        <Text style={StartStyles.buttonText}>Duomenų įvestis</Text>
      </TouchableOpacity>
    </View>
  );
}

function DBDetailsInputScreen({ navigation }) {
  const [www_id, setwww_id] = useState('');
  const [day, setDay] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const defaultValues = [
      ['duration', '200'],
      ['frequency', '700'],
      ['server_addr', '127.0.0.1'],
      ['status', 'STATUS_NONE'], // status should be a string if it's not a variable
      ['time_diff', '0'],
      ['CLASSES', '{}'],
      ['COUNT', '0'],
      ['DAY', '1'],
      ['PARTICIPANTS', '[]'],
      ['START', '0'],
      ['TITLE', ''],
      ['WWW_ID', '']
    ];

    defaultValues.forEach(async([key, value]) => {
      try{
        const existingValue = await AsyncStorage.getItem(key);
        if(existingValue == null) {
          await AsyncStorage.setItem(key, value);
        }
      } catch (error) {
        console.error('Error', error);
      }
    })
  }, []);

  const handlePress = async (e) => {
    e.preventDefault();

    if (!www_id || !day) {
      Alert.alert('Neteisinga įvestis');
      return;
    }

    try {
      const response = await fetch(
        `https://dbsportas.lt/ajaxvarz.php?action=si&varz=${www_id}&diena=${day}&action=si`,
        { method: 'GET' }
      );

      const data = await response.json();

      // Storing in AsyncStorage with stringified values
      await AsyncStorage.setItem('DAY', String(data['DAY']));
      await AsyncStorage.setItem('START', String(data['START']));
      await AsyncStorage.setItem('TITLE', String(data['TITLE']));
      await AsyncStorage.setItem('WWW_ID', String(data['WWW_ID'])); // Stringify WWW_ID
      console.log('Full API response:', data);
      const participants = data['PARTICIPANTS'];
      if (!Array.isArray(participants)) {
        throw new Error('PARTICIPANTS is not an array or is missing');
      }
      await AsyncStorage.setItem('COUNT', participants.length.toString());

      const classes = {};
      const updatedParticipants = participants
        .map(participant => {
          const updatedParticipant = { ...participant };
          if (!classes.hasOwnProperty(updatedParticipant['CLASS'])) {
            classes[updatedParticipant['CLASS']] = 1;
          }
          updatedParticipant['STARTED'] = updatedParticipant['START_INFO'].substr(0, 1) ? 'checked' : '';
          updatedParticipant['NOTES'] = updatedParticipant['START_INFO'].substr(1);
          return updatedParticipant;
        })
        .sort((a, b) => {
          return a.START - b.START;
        })

      await AsyncStorage.setItem('CLASSES', JSON.stringify(classes));  // Stringify classes
      await AsyncStorage.setItem('PARTICIPANTS', JSON.stringify(updatedParticipants)); // Stringify participants

      const jsonData = {
        DAY: data['DAY'],
        START: data['START'],
        TITLE: data['TITLE'],
        WWW_ID: data['WWW_ID'],
        COUNT: participants.length,
        CLSSES: classes,
        PARTICIPANTS: updatedParticipants,
      };

      const fileUri = `${FileSystem.documentDirectory}content.json`;
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(jsonData, null, 2));
      console.log(`File saved at ${fileUri}`);

      // pass data to Details

      navigation.navigate('Pasirinkimai');


      //restoreStatusLoaded();

    } catch (error) {
      console.error('Fetch error:', error);
      error_message(error);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={{
          position: 'absolute',
          top: 10, // <- adjust this to move it higher
          right: 20,
          zIndex: 10,
        }}
      >
        <Ionicons name="close" size={32} color="black" />
      </TouchableOpacity>
      <DBSportLogo style={StartStyles.image} />
      <TextInput
        value={www_id}
        onChangeText={setwww_id}
        placeholder="Iveskite ID"
        style={[styles.input, StartStyles.spec]}
      />
      <TextInput
        value={day}
        onChangeText={setDay}
        placeholder="Įveskite dieną"
        style={styles.inputNum}
      />
      <Pressable
        style={styles.button}
        onPress={handlePress}
      >
        <Text style={styles.text}>Aktyvuoti</Text>
      </Pressable>
    </View>
  );
}

function DBChoices ({ navigation }) {
  const [participants, setParticipants] = useState([]);

  useEffect(() => {
    const loadParticipants = async () => {
      const fileUri = `${FileSystem.documentDirectory}content.json`;

      try {
        const fileContent = await FileSystem.readAsStringAsync(fileUri);
        const jsonData = JSON.parse(fileContent);
        setParticipants(jsonData.PARTICIPANTS || []);
      } catch (error) {
        console.error('Failed to load participants:', error);
      }
    };

    loadParticipants();
  }, []);

  const handleNavigation = (screen) => {
    navigation.navigate(screen);
  };

  const validateIP = (ip) => {
    const ipParts = ip.split(".");
    return ipParts.length === 4 && ipParts.every((part) => !isNaN(part) && part >= 0 && part <= 255);
  };

  const handlePassData = async () => {
    try {
      const serverAddr = "127.0.0.0"; // Replace with actual server IP
      if (!validateIP(serverAddr)) {
        Alert.alert("Neprisijungete");
        return;
      }

      const filteredParticipants = participants
        .filter((p) => p.STARTED === "checked")
        .map((p) => ({ [p.NUMBER]: `+${p.NOTES || ""}` }));

      const startInfo = { start_info: Object.assign({}, ...filteredParticipants) };

      const response = await fetch(`http://${serverAddr}:8001/api/start_app_upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(startInfo),
      });

      if (!response.ok) {
        throw new Error(`Failed to send data: ${response.status}`);
      }

      console.log("Data sent successfully:", await response.json());
    } catch (error) {
      console.error("Error sending data:", error);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ position: 'absolute', top: 60, right: 40, zIndex: 10}}>
        <Ionicons name="close" size={32} color="black" />
      </TouchableOpacity>
      <Pressable style={styles.button} onPress={() => handleNavigation("Filtras Dalyviams")}>
        <Text style={styles.text}>Starto Protokolai Dalyviams</Text>
      </Pressable>

      <Pressable style={styles.button} onPress={() => handleNavigation("Filtras")}>
        <Text style={styles.text}>Starto Protokolai Organizatoriams</Text>
      </Pressable>

      <Pressable style={styles.button} onPress={() => handleNavigation("ClockInput")}>
        <Text style={styles.text}>Starto Laikrodis</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={handlePassData}>
        <Text style={styles.text}>Išsiųsti duomenis</Text>
      </Pressable>
    </View>
  );
};

function FilterScreen ({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [allGroups, setAllGroups] = useState([]);

  useEffect(() => {
    const fetchData = async() => {
      const fileUri = `${FileSystem.documentDirectory}content.json`;

      try {
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if(!fileInfo.exists) {
          console.error('File content.json does not exist.');
          setLoading(false);
          return;
        }
        const fileContent = await FileSystem.readAsStringAsync(fileUri);
        const jsonData = JSON.parse(fileContent);

        const groupSet = Array.from(new Set(jsonData.PARTICIPANTS.map((p) => p.CLASS)));

        // Set the main properties
        setParticipants(jsonData.PARTICIPANTS || {});
        setAllGroups(groupSet);

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const toggleSelectAll = () => {
    if (selectedGroups.length === allGroups.length) {
      setSelectedGroups([]);
    } else {
      setSelectedGroups(allGroups);
    }
  }

  const handleConfirmFilter = () => {
    const filteredParticipants = participants.filter((p) =>
      selectedGroups.includes(p.CLASS)
    );

    setSelectedGroups([]);

    navigation.navigate('Offsetas', {filteredParticipants});
  };

  if (loading) {
    return (
      <View style={FilterStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text>Kraunama...</Text>
      </View>
    );
  }

  return (
    <View style={FilterStyles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ position: 'absolute', top: 60, right: 20, zIndex: 10}}>
        <Ionicons name="close" size={32} color="black" />
      </TouchableOpacity>
        <View style={FilterStyles.modalContainer}>
          <ScrollView contentContainerStyle={FilterStyles.scrollContent}>
            <View style={FilterStyles.checkboxRow}>
              <Text style={FilterStyles.checkboxLabel}>Pasirinkti visus</Text>
              <TouchableOpacity
                style={FilterStyles.checkboxContainer}
                onPress={toggleSelectAll}
              >
                <View
                  style={[
                    FilterStyles.checkbox,
                    selectedGroups.length === allGroups.length
                      ? FilterStyles.checked
                      : FilterStyles.unchecked,
                  ]}
                />
              </TouchableOpacity>
            </View>
            {Array.from(new Set(participants.map((p) => p.CLASS))).map((group) => (
              <View key={group} style={FilterStyles.checkboxRow}>
                <Text style={FilterStyles.checkboxLabel}>{group}</Text>
                <TouchableOpacity
                  style={FilterStyles.checkboxContainer}
                  onPress={() => {
                    setSelectedGroups((prev) =>
                      prev.includes(group)
                        ? prev.filter((g) => g !== group)
                        : [...prev, group]
                    );
                  }}
                >
                  <View
                    style={[
                      FilterStyles.checkbox,
                      selectedGroups.includes(group) ? FilterStyles.checked : FilterStyles.unchecked,
                    ]}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <View style={FilterStyles.confirmButtonContainer} >
            <TouchableOpacity
              style={FilterStyles.confirmButton}
              onPress={handleConfirmFilter}
            >
              <Text style={MainStyles.confirmButtonText}>Tęstii</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
  )
}

function debounce(func, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

function MainInput ({ navigation, route }) {
  const [offsetMinutes, setOffsetMinutes] = useState('');
  const {filteredParticipants} = route.params;

  const handlePress = (e) => {
    e.preventDefault();
    try {
      const offset = parseInt(offsetMinutes) || 0;
      navigation.navigate('Pagrindinis', { offsetMinutes, filteredParticipants });
    } catch (error) {
      console.error("Something ain't right", error)
    }
  }

  return (
    <View style={ClockStyles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ position: 'absolute', top: 60, right: 40, zIndex: 10}}>
        <Ionicons name="close" size={32} color="black" />
      </TouchableOpacity>
      <View style={ClockStyles.inputContainer}>
        <Text style={ClockStyles.inputText}>Atsilikimas minutėmis </Text>
        <TextInput
          style={ClockStyles.inputBox}
          value={offsetMinutes}
          onChangeText={setOffsetMinutes}
          placeholder=""
          placeholderTextColor='#9E9E9E'
          keyboardType="default"
        />
        <TouchableOpacity
          style={ClockStyles.button}
          onPress={handlePress}
        >
          <Text style={ClockStyles.buttonText}>Tęsti</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function MainScreen({ route, navigation }) {
  const { filteredParticipants, offsetMinutes } = route.params;
  const offset = parseInt(offsetMinutes) || 0;
  const [participants, setParticipants] = useState([]);
  const [matchedIndices, setMatchedIndices] = useState([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [raktas, setRaktas] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const fileUri = `${FileSystem.documentDirectory}content.json`;
      try {
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (!fileInfo.exists) throw new Error('File not found.');
        const content = await FileSystem.readAsStringAsync(fileUri);
        const json = JSON.parse(content);
        setParticipants(json.PARTICIPANTS || []);

        if (json.raktas) {
          setRaktas(json.raktas);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const uploadInterval = setInterval(() => {
      uploadModifiedParticipants();
    }, 10 * 60 * 1000); // Every 10 minutes

    return () => clearInterval(uploadInterval);
  }, [participants]);

  const uploadModifiedParticipants = async () => {
    const changed = participants.filter(p => wasModifiedInLast10Minutes(p.LAST_MODIFIED));

    if (changed.length === 0) return;

    try {
      const response = await fetch('https://dbsportas/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participants: changed,
          raktas
         }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      console.log(`Uploaded ${changed.length} modified participants`);
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      now.setMinutes(now.getMinutes() + offset);
      setCurrentTime((prev) => {
        if (
          prev.getHours() !== now.getHours() ||
          prev.getMinutes() !== now.getMinutes()
        ) {
          return now;
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [offset]);

  const visibleParticipants = useMemo(() => {
    return participants.filter(p =>
      filteredParticipants.some(f => f.NUMBER === p.NUMBER)
    );
  }, [participants, filteredParticipants]);

  useEffect(() => {
    const handler = debounce(() => {
      if (searchQuery) {
        const matches = visibleParticipants.map((p, i) =>
          p.NAME.toLowerCase().includes(searchQuery.toLowerCase()) ? i : null
        ).filter(i => i !== null);
        setMatchedIndices(matches);
        setCurrentMatchIndex(matches.length > 0 ? 0 : -1);
      } else {
        setMatchedIndices([]);
        setCurrentMatchIndex(-1);
      }
    }, 300);
    handler();
  }, [searchQuery, visibleParticipants]);

  const scrollToMatch = (index) => {
    flatListRef.current?.scrollToIndex({ index, animated: true });
  };

  const navigateToMatch = (direction) => {
    if (matchedIndices.length === 0) return;
    const nextIndex =
      direction === "next"
        ? (currentMatchIndex + 1) % matchedIndices.length
        : (currentMatchIndex - 1 + matchedIndices.length) % matchedIndices.length;
    setCurrentMatchIndex(nextIndex);
    scrollToMatch(matchedIndices[nextIndex]);
  };

  const toggleExpand = () => {
    setIsExpanded(prev => !prev);
    Animated.timing(fadeAnim, {
      toValue: isExpanded ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const toggleSearchBox = () => {
    setIsSearchVisible(prev => !prev);
    setSearchQuery("");
  };

  const handleCheckboxChange = (participant) => {
    const updated = participants.map(p =>
      p.NUMBER === participant.NUMBER
        ? { ...p, STARTED: p.STARTED === 'checked' ? '' : 'checked', LAST_MODIFIED: getCurrentTimestamp() }
        : p
    );
    setParticipants(updated);
    saveUpdatedParticipants(updated);
  };

  const handleNoteChange = (participant, text) => {
    const updated = participants.map(p =>
      p.NUMBER === participant.NUMBER
        ? { ...p, NOTES: text, LAST_MODIFIED: getCurrentTimestamp() }
        : p
    );
    setParticipants(updated);
    saveUpdatedParticipants(updated);
  };

  const handleCardChange = (participant, text) => {
    const updated = participants.map(p =>
      p.NUMBER === participant.NUMBER
        ? { ...p, CARD: text, LAST_MODIFIED: getCurrentTimestamp() }
        : p
    );
    setParticipants(updated);
    saveUpdatedParticipants(updated);
  };

  const saveUpdatedParticipants = async (updated) => {
    const fileUri = `${FileSystem.documentDirectory}content.json`;
    try {
      const content = await FileSystem.readAsStringAsync(fileUri);
      const json = JSON.parse(content);
      json.PARTICIPANTS = updated;
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(json));
    } catch (error) {
      console.error('Error saving:', error);
    }
  };

  const formatTime = (timeInSeconds) => {
    const h = Math.floor(timeInSeconds / 3600);
    const m = Math.floor((timeInSeconds % 3600) / 60);
    const s = timeInSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const highlightText = (text, query) => {
    if (!query) return <Text>{text}</Text>;
    const regex = new RegExp(`(${query})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, index) =>
      regex.test(part) ? <Text key={index} style={{ color: 'red', fontWeight: 'bold' }}>{part}</Text> : <Text key={index}>{part}</Text>
    );
  };

  const isSameTime = (startSeconds, now) => {
    const startHours = Math.floor(startSeconds / 3600);
    const startMinutes = Math.floor((startSeconds % 3600) / 60);
    return startHours === now.getHours() && startMinutes === now.getMinutes();
  };

  const renderItem = useCallback(({ item, index }) => {
    const showStart = index === 0 || item.START !== visibleParticipants[index - 1].START;
    const highlight = isSameTime(item.START, currentTime);

    return (
      <View>
        {showStart && (
          <View style={[MainStyles.startTextContainer, highlight && { backgroundColor: '#A1D297' }]}>
            <Text style={MainStyles.startText}>{formatTime(item.START)}</Text>
          </View>
        )}
        <View style={[MainStyles.participantWrapper, highlight && { backgroundColor: "#A1D297" }]}>
          <View style={MainStyles.participantContainer}>
            <View style={MainStyles.participantLeft}>
              <Text style={MainStyles.participantText}>Numeris: {item.NUMBER}</Text>
              <Text style={MainStyles.participantText}>
                Pavardė, Vardas: {highlightText(item.NAME, searchQuery)}
              </Text>
              <Text style={MainStyles.participantText}>Grupė: {item.CLASS}</Text>
            </View>

            <View style={MainStyles.cardBox}>
              <TextInput
                style={MainStyles.cardInput}
                value={item.CARD || ''}
                onChangeText={(text) => handleCardChange(item, text)}
                keyboardType="numeric"
              />
            </View>

            <TextInput
              style={MainStyles.notesInput}
              value={item.NOTES || ''}
              placeholder='komentaras'
              placeholderTextColor={"#C2C1C1"}
              onChangeText={(text) => handleNoteChange(item, text)}
            />
            <TouchableOpacity
              style={MainStyles.checkboxContainer}
              onPress={() => handleCheckboxChange(item)}
            >
              <View style={[MainStyles.checkbox, item.STARTED === 'checked' ? MainStyles.checked : MainStyles.unchecked]} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }, [visibleParticipants, currentTime, searchQuery]);

  if (loading) {
    return (
      <View style={MainStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text>Loading data...</Text>
      </View>
    );
  }

  return (
    <View style={MainStyles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ position: 'absolute', top: 60, right: 20, zIndex: 10 }}>
        <Ionicons name="close" size={32} color="black" />
      </TouchableOpacity>

      {isSearchVisible && (
        <View style={MainStyles.searchBox}>
          <TextInput
            style={MainStyles.searchInput}
            placeholder="Ieškokite pagal vardą ar pavardę"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity style={MainStyles.navButton} onPress={() => navigateToMatch("prev")}>
            <Ionicons name='arrow-up' size={10} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={MainStyles.navButton} onPress={() => navigateToMatch("next")}>
            <Ionicons name='arrow-down' size={10} color="white" />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={visibleParticipants}
        extraData={currentTime}
        keyExtractor={(item) => item.NUMBER.toString()}
        contentContainerStyle={MainStyles.scrollContainer}
        getItemLayout={(_, index) => ({ length: 150, offset: 150 * index, index })}
        renderItem={renderItem}
      />

      <View style={MainStyles.floatingButtonContainer}>
        {true && (
          <Animated.View style={[MainStyles.extraButtonsContainer, { opacity: fadeAnim }]}>
            <TouchableOpacity style={MainStyles.extraButton} onPress={toggleSearchBox}>
              <Ionicons name="search-outline" size={24} color="white" />
            </TouchableOpacity>
          </Animated.View>
        )}
        <TouchableOpacity style={MainStyles.floatingButton} onPress={toggleExpand}>
          <Ionicons name={isExpanded ? "remove-outline" : "ellipsis-horizontal-outline"} size={32} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FilterScreenComp ({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [allGroups, setAllGroups] = useState([]);

  useEffect(() => {
    const fetchData = async() => {
      const fileUri = `${FileSystem.documentDirectory}content.json`;

      try {
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if(!fileInfo.exists) {
          console.error('File content.json does not exist.');
          setLoading(false);
          return;
        }
        const fileContent = await FileSystem.readAsStringAsync(fileUri);
        const jsonData = JSON.parse(fileContent);
        const groupSet = Array.from(new Set(jsonData.PARTICIPANTS.map((p) => p.CLASS)));

        // Set the main properties
        setParticipants(jsonData.PARTICIPANTS || {});
        setAllGroups(groupSet);

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const toggleSelectAll = () => {
    if (selectedGroups.length === allGroups.length) {
      setSelectedGroups([]); // deselect all
    } else {
      setSelectedGroups(allGroups); // select all
    }
  };

  const handleConfirmFilter = () => {
    const filteredParticipants = participants.filter((p) =>
      selectedGroups.includes(p.CLASS)
    );

    setSelectedGroups([]);

    navigation.navigate('Starto protokolai', { filteredParticipants });
  };

  if (loading) {
    return (
      <View style={FilterStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text>Kraunama...</Text>
      </View>
    );
  }

  return (
    <View style={FilterStyles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ position: 'absolute', top: 60, right: 20, zIndex: 10}}>
        <Ionicons name="close" size={32} color="black" />
      </TouchableOpacity>
      <View style={FilterStyles.modalContainer}>
          <ScrollView contentContainerStyle={FilterStyles.scrollContent}>
            <View style={FilterStyles.checkboxRow}>
                <Text style={FilterStyles.checkboxLabel}>Pasirinkti visus</Text>
                <TouchableOpacity
                  style={FilterStyles.checkboxContainer}
                  onPress={toggleSelectAll}
                >
                  <View
                    style={[
                      FilterStyles.checkbox,
                      selectedGroups.length === allGroups.length
                        ? FilterStyles.checked
                        : FilterStyles.unchecked,
                    ]}
                  />
                </TouchableOpacity>
              </View>
            {Array.from(new Set(participants.map((p) => p.CLASS))).map((group) => (
              <View key={group} style={FilterStyles.checkboxRow}>
                <Text style={FilterStyles.checkboxLabel}>{group}</Text>
                <TouchableOpacity
                  style={FilterStyles.checkboxContainer}
                  onPress={() => {
                    setSelectedGroups((prev) =>
                      prev.includes(group)
                        ? prev.filter((g) => g !== group)
                        : [...prev, group]
                    );
                  }}
                >
                  <View
                    style={[
                      FilterStyles.checkbox,
                      selectedGroups.includes(group) ? FilterStyles.checked : FilterStyles.unchecked,
                    ]}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <View style={FilterStyles.confirmButtonContainer} >
            <TouchableOpacity
              style={FilterStyles.confirmButton}
              onPress={handleConfirmFilter}
            >
              <Text style={MainStyles.confirmButtonText}>Tęstii</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
  )
}

function MainScreenComp({ route, navigation }) {
  const { filteredParticipants } = route.params;
  const [participants, setParticipants] = useState([]);
  const [groupedBuckets, setGroupedBuckets] = useState([[], [], [], []]);
  const [stickyLabels, setStickyLabels] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(true);

  const scrollRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const scrollOffsets = [useRef(0), useRef(0), useRef(0), useRef(0)];
  const scrollHeights = [useRef(0), useRef(0), useRef(0), useRef(0)];
  const containerHeights = [useRef(0), useRef(0), useRef(0), useRef(0)];
  const groupTops = [useRef({}), useRef({}), useRef({}), useRef({})];

  const splitParticipantsByCount = (participants) => {
    const classGroups = {};

    participants.forEach((p) => {
      if (!classGroups[p.CLASS]) classGroups[p.CLASS] = [];
      classGroups[p.CLASS].push(p);
    });

    const sortedClasses = Object.entries(classGroups).sort(
      (a, b) => b[1].length - a[1].length
    );

    const buckets = [[], [], [], []];
    const bucketCounts = [0, 0, 0, 0];

    sortedClasses.forEach(([className, members]) => {
      const targetIndex = bucketCounts.indexOf(Math.min(...bucketCounts));
      buckets[targetIndex].push({ className, members });
      bucketCounts[targetIndex] += members.length;
    });

    return buckets;
  };

  useEffect(() => {
    const fetchData = async () => {
      const fileUri = `${FileSystem.documentDirectory}content.json`;

      try {
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (!fileInfo.exists) {
          console.error("File content.json does not exist.");
          setLoading(false);
          return;
        }

        const fileContent = await FileSystem.readAsStringAsync(fileUri);
        const jsonData = JSON.parse(fileContent);

        const validParticipants = jsonData.PARTICIPANTS.filter(p => !!p.CLASS);
        const buckets = splitParticipantsByCount(validParticipants);

        setParticipants(validParticipants);
        setGroupedBuckets(buckets);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const pauseDuration = 5000; // 5 seconds
    const scrollStep = 30;
    const scrollDelay = 700;
    const timers = [];

    scrollRefs.forEach((ref, index) => {
      let isPaused = false;

      const scrollLoop = async () => {
        if (!ref.current) return;

        const offset = scrollOffsets[index].current;
        const contentHeight = scrollHeights[index].current;
        const viewHeight = containerHeights[index].current;

        // Bottom detection
        const isAtBottom = offset + viewHeight >= contentHeight - scrollStep;
        const isAtTop = offset === 0;

        if (isAtBottom && !isPaused) {
          isPaused = true;
          await new Promise(resolve => setTimeout(resolve, pauseDuration));
          scrollOffsets[index].current = 0;
          ref.current.scrollTo({ y: 0, animated: false });
          await new Promise(resolve => setTimeout(resolve, pauseDuration));
          isPaused = false;
        } else if (isAtTop && !isPaused && offset === 0) {
          isPaused = true;
          await new Promise(resolve => setTimeout(resolve, pauseDuration));
          isPaused = false;
        } else if (!isPaused) {
          scrollOffsets[index].current += scrollStep;
          ref.current.scrollTo({ y: scrollOffsets[index].current, animated: true });
        }

        timers[index] = setTimeout(scrollLoop, scrollDelay);
      };

      scrollLoop();
    });

    return () => timers.forEach(clearTimeout);
  }, []);

  const formatTime = (timeInSeconds) => {
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = timeInSeconds % 60;
    const pad = (num) => String(num).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  if (loading) {
    return (
      <View style={MainStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text>Loading data...</Text>
      </View>
    );
  }

  return (
    <View style={MainScreenStyles.screenContainer}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={MainScreenStyles.closeButton}
      >
        <Ionicons name="close" size={32} color="#388e3c" />
      </TouchableOpacity>

      {groupedBuckets.map((bucket, columnIndex) => (
        <View
          key={columnIndex}
          style={[
            MainScreenStyles.column,
            columnIndex === 0 && { borderLeftWidth: 0 } // remove border for first column
          ]}
        >
          <View style={MainScreenStyles.stickyHeader}>
            <Text style={MainScreenStyles.stickyHeaderText}>
              {stickyLabels[columnIndex]}
            </Text>
          </View>

          <ScrollView
            ref={scrollRefs[columnIndex]}
            style={{ marginTop: 40 }}
            contentContainerStyle={MainScreenStyles.scrollContent}
            onContentSizeChange={(w, h) => {
              scrollHeights[columnIndex].current = h;
            }}
            onLayout={(e) => {
              containerHeights[columnIndex].current = e.nativeEvent.layout.height;
            }}
            onScroll={(e) => {
              const y = e.nativeEvent.contentOffset.y;
              const tops = groupTops[columnIndex].current;
              let closest = { name: "", offset: Infinity };

              Object.entries(tops).forEach(([className, top]) => {
                if (top <= y && y - top < closest.offset) {
                  closest = { name: className, offset: y - top };
                }
              });

              setStickyLabels(prev => {
                const updated = [...prev];
                updated[columnIndex] = closest.name || "";
                return updated;
              });
            }}
            scrollEventThrottle={16}
          >
            {bucket.map(({ className, members }) => (
              <View
                key={className}
                onLayout={(e) => {
                  groupTops[columnIndex].current[className] = e.nativeEvent.layout.y;
                }}
                style={MainScreenStyles.classGroup}
              >
                <Text style={MainScreenStyles.classTitle}>{className}</Text>
                {members.map((participant) => (
                  <View
                    key={participant.NUMBER}
                    style={MainScreenStyles.participantCard}
                  >
                    <Text style={MainScreenStyles.participantText}>
                      {participant.NUMBER} {participant.NAME}
                    </Text>
                    <Text style={MainScreenStyles.timeText}>
                      {formatTime(participant.START)}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

function ClockInput ({ navigation }) {
  const [offsetMinutes, setOffsetMinutes] = useState('');
  const [mode, setMode] = useState('clock');
  const [showParticipants, setShowParticipants] = useState(true);

  const handlePress = (e) => {
    e.preventDefault();
    try {
      const offset = parseInt(offsetMinutes) || 0;
      console.log(offset);
      navigation.navigate('Clock', { offset, mode, showParticipants });
    } catch (error) {
      console.error("Something ain't right", error)
    }
  }

  return (
    <View style={ClockStyles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ position: 'absolute', top: 60, right: 40, zIndex: 10}}>
        <Ionicons name="close" size={32} color="black" />
      </TouchableOpacity>
      <View style={ClockStyles.inputContainer}>
        <Text style={ClockStyles.inputText}>Atsilikimas minutėmis </Text>
        <TextInput
          style={ClockStyles.inputBox}
          value={offsetMinutes}
          onChangeText={setOffsetMinutes}
          placeholder=""
          placeholderTextColor='#9E9E9E'
          keyboardType="default"
        />
        <Text style={ClockStyles.inputText}>Pasirinkite laikrodžio tipą l</Text>
        <View style={ClockStyles.modeSelector}>
            <TouchableOpacity
              style={[
                ClockStyles.modeButton,
                mode === 'clock' && ClockStyles.activeModeButton,
              ]}
              onPress={() => setMode('clock')}
            >
              <Text style={ClockStyles.modeText}>Einantis Laikrodis</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                ClockStyles.modeButton,
                mode === 'timer' && ClockStyles.activeModeButton,
              ]}
              onPress={() => setMode('timer')}
            >
              <Text style={ClockStyles.modeText}>Stovintis Laikrodis</Text>
            </TouchableOpacity>
        </View>
        <View style={{ marginVertical: 20, alignItems: 'center' }}>
          <Text style={{ fontSize: 30, marginBottom: 8 }}>Rodyti dalyvius </Text>
          <TouchableOpacity
            onPress={() => setShowParticipants(prev => !prev)}
            style={{
              backgroundColor: showParticipants ? '#4caf50' : '#ccc',
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: 'white', fontSize: 20, }}>{showParticipants ? 'Taip ' : 'Ne'}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={ClockStyles.button}
          onPress={handlePress}
        >
          <Text style={ClockStyles.buttonText}>Tęsti</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function DClock ({ route, navigation }) {
  const { offset, mode, showParticipants } = route.params;
  const [currentTime, setCurrentTime] = useState(new Date());
  const [participants, setParticipants] = useState([]);
  const [sound, setSound] = useState(null);
  const [garsas, setGarsas] = useState(null);

  const getFontSize = () => {
    const total = upcomingParticipants.length;
    if (total <= 2) return 44;
    if (total <= 4) return 38;
    if (total <= 6) return 34;
    return 30;
  };

  useEffect(() => {
    const loadSounds = async () => {
      try {
        const { sound: beepSound } = await Audio.Sound.createAsync(
          require('../assets/images/beep.mp3')
        );
        setSound(beepSound);

        const { sound: longBeepSound } = await Audio.Sound.createAsync(
          require('../assets/images/longbeep.mp3')
        );
        setGarsas(longBeepSound);
      } catch (error) {
        console.error('Error loading sounds:', error);
      }
    };

    loadSounds();

    return () => {
      sound?.unloadAsync();
      garsas?.unloadAsync();
    };
  }, []);

  useEffect(() => {
    if (sound && garsas) {
      const interval = setInterval(() => {
        const now = new Date();
        now.setMinutes(now.getMinutes() + offset);
        setCurrentTime(now);

        if (now.getSeconds() === 0) playLongBeep();
        else if (now.getSeconds() >= 55 && now.getSeconds() <= 59) playShortBeep();
        else if (now.getSeconds() === 50) playDoubleBeep();
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [offset, sound, garsas]);

  const playLongBeep = async () => {
    try {
      if (garsas) {
        await garsas.playAsync();
        setTimeout(() => garsas.stopAsync(), 800);
      }
    } catch (error) {
      console.error('Error playing long beep:', error);
    }
  };

  const playDoubleBeep = async () => {
    try {
      if (sound) {
        await sound.replayAsync();
        setTimeout(() => sound.replayAsync(), 300);
      }
    } catch (error) {
      console.error('Error playing double beep:', error);
    }
  };

  const playShortBeep = async () => {
    try {
      if (sound) await sound.replayAsync();
    } catch (error) {
      console.error('Error playing short beep:', error);
    }
  };

  useEffect(() => {
    if (!showParticipants) return;

    const fetchData = async () => {
      const fileUri = `${FileSystem.documentDirectory}content.json`;
      try {
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (!fileInfo.exists) throw new Error('File content.json does not exist.');

        const fileContent = await FileSystem.readAsStringAsync(fileUri);
        const jsonData = JSON.parse(fileContent);
        setParticipants(jsonData.PARTICIPANTS || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  const convertSecondsToTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return { hours, minutes };
  };

  const isTimeMatching = (participantTime, currentTime) => {
    let hours, minutes;
    if (mode === 'clock') {
      ({ hours, minutes } = convertSecondsToTime(participantTime - 60));
    } else {
      ({ hours, minutes } = convertSecondsToTime(participantTime));
    }
    return hours === currentTime.getHours() && minutes === currentTime.getMinutes();
  };

  const upcomingParticipants = useMemo(() => {
    return participants.filter((participant) => isTimeMatching(participant.START, currentTime));
  }, [participants, currentTime]);

  const getItemWidth = () => {
    const total = upcomingParticipants.length;
    if (total <= 4) return '48%';
    if (total <= 6) return '31%';
    return '23%';
  };

  return (
    <View style={ClockStylesON.container}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={ClockStylesON.closeButton}
      >
        <Ionicons name="close" size={32} color="#388e3c" />
      </TouchableOpacity>

      <View style={ClockStylesON.timeBox}>
        <Text style={ClockStylesON.timeText}>
          {mode === 'clock'
            ? currentTime.toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
            : currentTime.toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' }) + ':00'}
        </Text>
      </View>

      {showParticipants && (
        <View style={ClockStylesON.participantsList}>
          {upcomingParticipants.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {upcomingParticipants.map((participant) => (
                <View
                  key={participant.NUMBER}
                  style={[ClockStylesON.participantItemContainer, { width: getItemWidth() }]}
                >
                  <Text
                    style={[ClockStylesON.participantName, { fontSize: getFontSize() }]}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.5}
                  >
                    {participant.NUMBER} {participant.NAME}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={ClockStylesON.noParticipantsText}>Nėra startuojančių dalyvių.</Text>
          )}
        </View>
      )}
    </View>
  );
};

export default function Index() {
  return (
    <Stack.Navigator initialRouteName="Pradžia">
      <Stack.Screen name="Pradžia" component={StartScreen} />
      <Stack.Screen name="Informacijos Įvestis" component={DBDetailsInputScreen} options={{ headerShown: false }}/>
      <Stack.Screen name="Pasirinkimai" component={DBChoices} options={{ headerShown: false }}/>
      <Stack.Screen name="Filtras" component={FilterScreen} options={{ headerShown: false }}/>
      <Stack.Screen name="Filtras Dalyviams" component={FilterScreenComp} options={{ headerShown: false }}/>
      <Stack.Screen name="Starto protokolai" component={MainScreenComp} options={{ headerShown: false }}/>
      <Stack.Screen name="Offsetas" component={MainInput} options={{ headerShown: false }}/>
      <Stack.Screen name="Pagrindinis" component={MainScreen} options={{ headerShown: false }}/>
      <Stack.Screen name="ClockInput" component={ClockInput} options={{ headerShown: false }}/>
      <Stack.Screen name="Clock" component={DClock} options={{ headerShown: false }}/>
    </Stack.Navigator>
  );
}

// STILIAI

const StartStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e8f5e9', // Light green background
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    margin: 20,
  },
  spec: {
    marginTop: 30,
  },
  image: {
    width: 150,
    height: 150,
    marginBottom: 20,
    paddingBottom: 30,
  },
  headeris: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#388e3c', // Darker green for text
    marginBottom: 30,
    marginTop: 40,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#4caf50', // Lighter green button
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25, // Rounded edges
    marginVertical: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3, // Subtle shadow for modern look
    elevation: 3, // Shadow for Android
  },
  buttonText: {
    fontSize: 16,
    color: '#ffffff', // White text
    fontWeight: '600',
  },
});

const ClockStylesON = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e8f5e9',
    padding: 16,
    paddingTop: 40,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 20,
    zIndex: 10,
  },
  timeBox: {
    height: '60%',
    backgroundColor: '#ffffff', // White background for the watch
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#108040', // Optional: subtle green outline
  },
  timeText: {
    color: '#000000', // Black numbers
    fontSize: 270,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  participantsList: {
    flex: 1,
    justifyContent: 'center',
  },
  participantItemContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#66bb6a',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100, // Allow enough room for large text
    flexGrow: 1,
  },
  participantName: {
    fontSize: 45,
    color: '#2e7d32',
    fontWeight: '600',
  },
  participantStartTime: {
    fontSize: 14,
    color: '#4caf50',
    marginTop: 4,
  },
  noParticipantsText: {
    textAlign: 'center',
    color: '#777',
    fontSize: 16,
    marginTop: 20,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    fontSize: 28, // Increased font size for prominence
    fontWeight: 'bold',
    color: '#108040',
    marginBottom: 30, // Increased margin for breathing space
    textAlign: 'center', // Center aligned for a cleaner look
    fontFamily: 'Roboto', // Using a more modern font
  },
  input: {
    width: '100%',
    height: 55, // Slightly increased height for better readability
    paddingHorizontal: 15,
    backgroundColor: '#ffffff',
    borderRadius: 10, // More rounded corners for a modern look
    borderWidth: 1,
    borderColor: '#108040',
    marginBottom: 15,
    fontSize: 16,
    fontFamily: 'Tahoma',
    shadowColor: '#000', // Adding subtle shadow for depth
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2, // Android shadow effect
  },
  inputUpper: {
    width: '100%',
    height: 55, // Slightly increased height for better readability
    paddingHorizontal: 15,
    backgroundColor: '#ffffff',
    borderRadius: 10, // More rounded corners for a modern look
    borderWidth: 1,
    borderColor: '#108040',
    marginBottom: 15,
    marginTop: 20,
    fontSize: 16,
    fontFamily: 'Tahoma',
    shadowColor: '#000', // Adding subtle shadow for depth
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2, // Android shadow effect
  },
  inputNum: {
    width: '100%',
    height: 55, // Consistent size with the text input
    paddingHorizontal: 15,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#108040',
    marginBottom: 20,
    fontSize: 16,
    fontFamily: 'Tahoma',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  button: {
    backgroundColor: '#108040',
    paddingVertical: 15, // Increased padding for a larger button
    paddingHorizontal: 35,
    borderRadius: 10, // Rounded button edges
    marginTop: 20, // Added more space between inputs and buttons
    shadowColor: '#000',
    width: 600,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3, // Shadow effect for depth on Android
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center', // Ensures text is centered
  },
  text: {
    color: 'white',
    fontSize: 25,
    fontWeight: 'bold',
  },
});

const FilterStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E9', // Light green background
    paddingRight: 50,
    paddingLeft: 50,
    paddingTop: 20,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#1B5E20', // Dark green
    fontWeight: 'bold',
  },
  checkboxContainer: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#4CAF50', // Primary green
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 2,
  },
  checked: {
    backgroundColor: '#4CAF50', // Primary green for checked state
  },
  unchecked: {
    backgroundColor: '#ffffff',
  },
  confirmButton: {
    marginTop: 20,
    backgroundColor: '#4CAF50', // Primary green
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'normal',
  },
  confirmButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff', // Matches the container background
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  scrollContent: {
    paddingBottom: 80, // Add padding to ensure space for the confirm button
  },
});

const MainStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e8f5e9', // Light background
    padding: 5,
  },
  participantLeft: {
    flex: 3,
    paddingRight: 10,
  },

  cardBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  cardInput: {
    width: '100%',
    fontSize: 25,
    padding: 8,
    height: 50,
    borderColor: '#616161',
    borderWidth: 1,
    borderRadius: 6,
    textAlign: 'center',
    color: '#333',
  },

  emptyBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 6,
    marginLeft: 5,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2, // For Android shadow
  },
  searchInput: {
    flex: 1,
    padding: 10,
    fontSize: 16,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    marginRight: 10,
  },
  navButton: {
    width: 32,
    height: 32,
    backgroundColor: '#108040', // Green theme
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginLeft: 5,
  },
  scrollContainer: {
    paddingBottom: 20,
  },
  participantWrapper: {
    marginBottom: 15,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2, // For Android shadow
  },
  startText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  startTextContainer: {
    backgroundColor: '#108040', // Prominent green background
    padding: 10,
    marginVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  participantContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoContainer: {
    flex: 3,
    width: 10,
  },
  participantText: {
    fontSize: 14,
    color: 'black',
    marginBottom: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
  },
  checkboxContainer: {
    width: 50,
    height: 50,
    borderWidth: 1,
    borderColor: '#616161',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
  },
  checkbox: {
    width: 45,
    height: 45,
    borderRadius: 4,
  },
  checked: {
    backgroundColor: '#108040', // Checked color
  },
  unchecked: {
    backgroundColor: '#ffffff',
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    alignItems: 'center',
  },
  extraButtonsContainer: {
    marginBottom: 10,
  },
  extraButton: {
    backgroundColor: '#108040',
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  floatingButton: {
    backgroundColor: '#108040',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  notesInput: {
    height: 50,
    width: 150,
    borderColor: '#616161',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    marginLeft: 10,
    fontSize: 14,
    color: '#C2C1C1',
  },
});

const MainScreenStyles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#e8f5e9',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 20,
    zIndex: 10,
  },
  column: {
    flex: 1,
    borderLeftWidth: 1,
    borderColor: '#a5d6a7',
    position: 'relative',
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#c8e6c9',
    zIndex: 10,
    padding: 8,
    borderBottomWidth: 1,
    borderColor: '#a5d6a7',
  },
  stickyHeaderText: {
    fontWeight: 'bold',
    fontSize: 18,
    color: '#2e7d32',
  },
  scrollContent: {
    marginTop: 40,
    padding: 10,
    paddingBottom: 30,
  },
  classGroup: {
    marginBottom: 20,
  },
  classTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#388e3c',
  },
  participantCard: {
    padding: 10,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#66bb6a',
  },
  participantText: {
    color: '#2e7d32',
    fontWeight: '500',
  },
  timeText: {
    color: '#4caf50',
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

const ClockStyles =  {
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    padding: 20,
  },
  inputContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  inputText: {
    fontSize: 30,
    color: "#333",
    marginBottom: 10,
  },
  inputBox: {
    borderWidth: 1,
    borderColor: "#CCC",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 20,
    width: 100,
    marginBottom: 15,
    textAlign: 'center',
  },
  button: {
    backgroundColor: "#4CAF50",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  modeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 16,
  },
  modeButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#999',
  },
  activeModeButton: {
    backgroundColor: '#4CAF50',
  },
  modeText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 20,
  },
};

const { height } = Dimensions.get('window');


const Clock = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  timeBox: {
    height: height * 0.55,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 250,
    fontWeight: 'bold',
    color: '#000',
  },
  participantsList: {
    height: height * 0.45,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  flatListContainer: {
    flexGrow: 1,
  },
  participantItemContainer: {
    margin: 4,
    padding: 10,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    justifyContent: 'center',
  },
  participantName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  participantStartTime: {
    fontSize: 14,
    color: '#333',
    marginTop: 4,
  },
  noParticipantsText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#999',
    marginTop: 20,
  },
});