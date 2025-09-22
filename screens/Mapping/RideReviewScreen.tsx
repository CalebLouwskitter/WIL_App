// RideReviewScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Dimensions,
  Button,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import RideStatsCard from '@/components/RideStatsCard';
import type { RideData } from '@/hooks/useRideTracker';
import { StackScreenProps } from '@react-navigation/stack';
import type { MappingStackParamList } from '@/navigation/MappingStack';




type Props = StackScreenProps<MappingStackParamList, 'RideReviewScreen'> & {
  onSubmit?: (payload: any) => void;
  onClose?:()=> void;
};


export default function RideReviewScreen({ route, navigation, onSubmit, onClose }: Props) {

const THEME_COLORS = ['#FFE2E5', '#FFF4DE', '#DCFCE7', '#F3E8FF', '#E8F0FF', '#FDF2F8'];



const ANIMALS = [
  { id: 'a_deer', label: 'Deer', emoji: '🦌', color: THEME_COLORS[0] },
  { id: 'a_bird', label: 'Bird', emoji: '🐦', color: THEME_COLORS[1] },
  { id: 'a_zebra', label: 'Zebra', emoji: '🦓', color: THEME_COLORS[2] },
  { id: 'a_buck', label: 'Buck', emoji: '🦌', color: THEME_COLORS[3] },
  { id: 'a_elephant', label: 'Elephant', emoji: '🐘', color: THEME_COLORS[0] },
  { id: 'a_rhino', label: 'Rhino', emoji: '🦏', color: THEME_COLORS[1] },
  { id: 'a_hyena', label: 'Hyena', emoji: '🦝', color: THEME_COLORS[2] },
  { id: 'a_monkey', label: 'Monkey', emoji: '🐒', color: THEME_COLORS[3] },
];

const QUICK_PILLS = ['bird', 'buck', 'zebra', 'deer', 'elephant'];

const REPORTS = [
  { id: 'r_pothole', label: 'Trail damage', emoji: '🛠️', color: THEME_COLORS[0] },
  { id: 'r_blocked', label: 'Blocked', emoji: '🪵', color: THEME_COLORS[1] },
  { id: 'r_flood', label: 'Flooding', emoji: '🌊', color: THEME_COLORS[2] },
  { id: 'r_erosion', label: 'Erosion', emoji: '⛰️', color: THEME_COLORS[3] },
  { id: 'r_litter', label: 'Litter', emoji: '🗑️', color: THEME_COLORS[4] },
  { id: 'r_unsafe', label: 'Unsafe', emoji: '⚠️', color: THEME_COLORS[5] },
  { id: 'r_sign', label: 'Sign missing', emoji: '📛', color: THEME_COLORS[0] },
  { id: 'r_other', label: 'Other', emoji: '❗', color: THEME_COLORS[1] },
];

  // sightings
  const [selectedAnimal, setSelectedAnimal] = useState<string | null>(null);
  const [sightingNotes, setSightingNotes] = useState('');
  const [sightingPicturePath, setSightingPicturePath] = useState<string | null>(null);

  // report
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [reportNotes, setReportNotes] = useState('');
  const [reportLocation, setReportLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // dirty flags to avoid accidental close
  const [startedSightOrReport, setStartedSightOrReport] = useState(false);

  // map ref
  const mapRef = useRef<MapView | null>(null);

  const { rideData, rideId } = route.params ?? {};

  const stats = useMemo(() => {
    if (!rideData) return { distance: 0, elevation: 0, duration: 0 };
    return {
      distance: rideData.totalDistance ?? 0,
      elevation: rideData.elevationGain ?? 0,
      duration: rideData.duration ?? 0,
    };
  }, [rideData]);

  // mark dirty when user starts typing/selecting
  useEffect(() => {
    if (selectedAnimal || sightingNotes.length > 0 || selectedReport || reportNotes.length > 0 || reportLocation) {
      setStartedSightOrReport(true);
    }
  }, [selectedAnimal, sightingNotes, selectedReport, reportNotes, reportLocation]);

  // navigation/back handling: ask user if they started but didn't submit
  useEffect(() => {
    const beforeRemove = (e: any) => {
      if (!startedSightOrReport) return;
      e.preventDefault();
      Alert.alert(
        'Finish entry?',
        'You started a sighting or report but did not submit. Do you want to finish it or discard?',
        [
          { text: 'Finish', style: 'cancel', onPress: () => {} },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              // allow navigation
              if (navigation) navigation.dispatch(e.data.action);
              else onClose?.();
            },
          },
        ]
      );
    };

    const sub = navigation.addListener('beforeRemove', beforeRemove);
    return () => navigation.removeListener('beforeRemove', beforeRemove);

    return undefined;
  }, [startedSightOrReport, navigation, onClose]);

  // pin drop handler for report location
  const onMapPress = (e: any) => {
    const { coordinate } = e.nativeEvent;
    setReportLocation(coordinate);
  };

  // Quick pills fill text
  const onPillPress = (text: string) => {
    setSightingNotes((prev) => (prev ? prev + ' ' + text : text));
  };

  const submitAll = () => {
    const nowISO = new Date().toISOString();
    const payload: any = {};

    if (selectedAnimal || sightingNotes || sightingPicturePath) {
      payload.sighting = {
        sighting_id: `sighting_${Math.random().toString(36).slice(2, 9)}`,
        animal_type: selectedAnimal ? ANIMALS.find((a) => a.id === selectedAnimal)!.label.toLowerCase() : undefined,
        notes: sightingNotes,
        picture_path: sightingPicturePath,
        ride_id: rideId ?? `ride_${rideData?.startTime ?? Date.now()}`,
        sighting_time: nowISO,
      };
    }

    if (selectedReport || reportNotes || reportLocation) {
      payload.report = {
        report_id: `report_${Math.random().toString(36).slice(2, 9)}`,
        location: reportLocation ?? null,
        type_of_issue: selectedReport ? REPORTS.find((r) => r.id === selectedReport)!.label : undefined,
        date: nowISO.slice(0, 10),
        time: nowISO,
        user_id: 'current_user_id', // replace with actual user id
        ride_id: rideId ?? `ride_${rideData?.startTime ?? Date.now()}`,
        notes: reportNotes,
      };
    }

    // If nothing was entered, allow close without submitting
    if (!payload.sighting && !payload.report) {
      onClose?.();
      return;
    }

    // TODO: send to server / local store. Call onSubmit to bubble up.
    onSubmit;
    onClose?.();   

    // reset
    setSelectedAnimal(null);
    setSightingNotes('');
    setSelectedReport(null);
    setReportNotes('');
    setReportLocation(null);
    setStartedSightOrReport(false);
    Alert.alert('Submitted', 'Thank you — your sighting/report was submitted.');
    onClose?.();
  };

  const tryClose = () => {
    if (startedSightOrReport) {
      Alert.alert('Unfinished entry', 'You started a sighting or report. Do you want to finish or discard?', [
        { text: 'Finish', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => onClose?.(),
        },
      ]);
    } else {
      onClose?.();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Ride review</Text>
        <TouchableOpacity onPress={tryClose} style={styles.closeBtn}>
          <Text style={{ color: '#1E293B' }}>Close</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
        {/* Stats */}
        <RideStatsCard distance={stats.distance} elevation={stats.elevation} durationMs={stats.duration} title="Ride summary" />

        {/* Animal Sightings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Animal sightings</Text>
          <Text style={styles.help}>Select an animal (tap to highlight), then add notes. Quick pills below.</Text>

          <View style={styles.grid}>
            {ANIMALS.map((a) => {
              const isSelected = a.id === selectedAnimal;
              return (
                <TouchableOpacity
                  key={a.id}
                  onPress={() => {
                    setSelectedAnimal(isSelected ? null : a.id);
                  }}
                  style={[
                    styles.catButton,
                    { backgroundColor: a.color },
                    isSelected ? styles.catButtonSelected : undefined,
                  ]}
                >
                  <Text style={styles.catEmoji}>{a.emoji}</Text>
                  <Text style={styles.catLabel}>{a.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            value={sightingNotes}
            onChangeText={setSightingNotes}
            placeholder="Short description (what, where, how many)..."
            style={styles.textBox}
            multiline
            numberOfLines={3}
          />

          <View style={styles.pillRow}>
            {QUICK_PILLS.map((p) => (
              <TouchableOpacity key={p} onPress={() => onPillPress(p)} style={styles.pill}>
                <Text style={styles.pillText}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Report */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Report an issue</Text>
          <Text style={styles.help}>Select issue type, add a description and drop a pin on the map.</Text>

          <View style={styles.grid}>
            {REPORTS.map((r) => {
              const isSelected = r.id === selectedReport;
              return (
                <TouchableOpacity
                  key={r.id}
                  onPress={() => setSelectedReport(isSelected ? null : r.id)}
                  style={[styles.catButton, { backgroundColor: r.color }, isSelected ? styles.catButtonSelected : undefined]}
                >
                  <Text style={styles.catEmoji}>{r.emoji}</Text>
                  <Text style={styles.catLabel}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            value={reportNotes}
            onChangeText={setReportNotes}
            placeholder="Describe the problem..."
            style={styles.textBox}
            multiline
            numberOfLines={3}
          />

          <View style={{ height: 220, marginTop: 8 }}>
            <MapView
              ref={mapRef}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_GOOGLE}
              style={{ flex: 1 }}
              initialRegion={{
                latitude: reportLocation?.latitude ?? (rideData?.path?.[rideData.path.length - 1]?.latitude ?? 0),
                longitude: reportLocation?.longitude ?? (rideData?.path?.[rideData.path.length - 1]?.longitude ?? 0),
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              onPress={onMapPress}
            >
              {reportLocation && <Marker coordinate={reportLocation} title="Report location" />}
            </MapView>
            <Text style={styles.mapHint}>{reportLocation ? 'Pin placed. Tap on map to move.' : 'Tap the map to drop a pin.'}</Text>
          </View>
        </View>

        <View style={{ height: 20 }} />

        <View style={styles.buttonRow}>
          <TouchableOpacity onPress={submitAll} style={styles.submitBtn}>
            <Text style={styles.submitText}>Submit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              // close without saving only if nothing started
              if (!startedSightOrReport) onClose?.();
              else
                Alert.alert('Unfinished entry', 'You started a sighting/report. If you close it will be discarded. Continue?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Discard & Close', style: 'destructive', onPress: () => onClose?.() },
                ]);
            }}
            style={styles.ghostBtn}
          >
            <Text style={styles.ghostText}>Close (no submit)</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFB' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  header: { fontSize: 18, fontWeight: '700' },
  closeBtn: { padding: 6 },

  section: { marginTop: 8, backgroundColor: '#fff', borderRadius: 12, padding: 12, shadowColor: '#000', shadowOpacity: 0.05, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  help: { fontSize: 12, color: '#6B7280', marginBottom: 8 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' as any },
  catButton: {
    width: 55,
    height: 55,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 6,
    padding: 4,
  },
  catButtonSelected: {
    transform: [{ translateY: -6 }],
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    borderWidth: 2,
    borderColor: '#111827',
  },
  catEmoji: { fontSize: 20 },
  catLabel: { fontSize: 10, textAlign: 'center' },

  textBox: {
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E6E9EE',
    padding: 8,
    backgroundColor: '#fff',
    minHeight: 60,
    textAlignVertical: 'top',
  },

  pillRow: { flexDirection: 'row', marginTop: 8, flexWrap: 'wrap' },
  pill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, backgroundColor: '#F3F4F6', marginRight: 8, marginBottom: 8 },
  pillText: { fontSize: 13, fontWeight: '600' },

  mapHint: { fontSize: 12, color: '#6B7280', marginTop: 6, textAlign: 'center' },

  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  submitBtn: { flex: 1, backgroundColor: '#1E88E5', padding: 14, borderRadius: 12, alignItems: 'center', marginRight: 8 },
  submitText: { color: '#fff', fontWeight: '700' },
  ghostBtn: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', flex: 1 },
  ghostText: { color: '#374151' },
});

