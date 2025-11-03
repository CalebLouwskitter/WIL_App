import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather as Icon } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { saveHorse } from '../../services/HorseStorage';
import { useColorScheme } from 'react-native';
import { Colors } from '../../constants/colors';

const CreateHorseScreen = () => {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];
  const styles = useMemo(() => createStyles(colors), [colors]);
  const placeholderColor = colors.placeholder;

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert('Missing name', 'Please enter a horse name.');
      return;
    }
    const ageNum = age ? Number(age) : undefined;
    if (age && Number.isNaN(ageNum)) {
      Alert.alert('Invalid age', 'Age must be a number.');
      return;
    }
    try {
      setSaving(true);
      await saveHorse({ name: name.trim(), breed: breed.trim() || undefined, age: ageNum, notes: notes.trim() || undefined });
      if (route?.params?.fromDashboard) {
        nav.getParent()?.navigate('Dashboard');
      } else if (route?.params?.returnToSelectHorse) {
        nav.getParent()?.navigate('Mapping' as never, { screen: 'SelectHorse' } as never);
      } else {
        nav.goBack();
      }
    } catch (e) {
      Alert.alert('Save failed', 'Could not save horse. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => {
              if (route?.params?.fromDashboard) {
                nav.getParent()?.navigate('Dashboard');
              } else if (route?.params?.returnToSelectHorse) {
                nav.getParent()?.navigate('Mapping' as never, { screen: 'SelectHorse' } as never);
              } else {
                nav.goBack();
              }
            }}
            style={styles.backBtn}
            activeOpacity={0.85}
          >
            <Icon name="chevron-left" size={24} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Horse</Text>
          <View style={styles.headerSpacer} />
        </View>

        <LinearGradient
          colors={[colors.gradientPrimaryStart, colors.gradientPrimaryEnd] as const}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroContent}>
            <View style={styles.heroIconWrapper}>
              <Icon name="compass" size={20} color={colors.onPrimary} />
            </View>
            <View style={styles.heroTextBlock}>
              <Text style={styles.heroTitle}>Register a new horse</Text>
              <Text style={styles.heroSubtitle}>Keep details handy to assign rides faster.</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Thunder"
            placeholderTextColor={placeholderColor}
            style={styles.input}
            selectionColor={colors.brandPrimary}
          />

          <Text style={styles.label}>Breed (optional)</Text>
          <TextInput
            value={breed}
            onChangeText={setBreed}
            placeholder="e.g. Arabian"
            placeholderTextColor={placeholderColor}
            style={styles.input}
            selectionColor={colors.brandPrimary}
          />

          <Text style={styles.label}>Age (optional)</Text>
          <TextInput
            value={age}
            onChangeText={setAge}
            placeholder="e.g. 7"
            placeholderTextColor={placeholderColor}
            keyboardType="numeric"
            style={styles.input}
            selectionColor={colors.brandPrimary}
          />

          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Temperament, training notes, etc."
            placeholderTextColor={placeholderColor}
            style={[styles.input, styles.notes]}
            multiline
            numberOfLines={4}
            selectionColor={colors.brandPrimary}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveBtnContainer, saving && styles.saveBtnDisabled]}
          onPress={onSave}
          activeOpacity={0.85}
          disabled={saving}
        >
          <LinearGradient
            colors={[colors.brandPrimary, colors.brandPrimaryAlt] as const}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.saveBtn}
          >
            <Text style={styles.saveTxt}>{saving ? 'Saving…' : 'Save Horse'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

type ThemeColors = typeof Colors.light;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.backgroundLight },
    container: { flexGrow: 1, padding: 20, paddingTop: 48 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    backBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
      backgroundColor: colors.surface,
      shadowColor: colors.shadowStrong,
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '700', color: colors.onSurface },
    headerSpacer: { width: 40 },
    heroCard: {
      borderRadius: 20,
      padding: 20,
      shadowColor: colors.shadowStrong,
      shadowOpacity: 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
      marginBottom: 24,
    },
    heroContent: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    heroIconWrapper: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTextBlock: { flex: 1 },
    heroTitle: { fontSize: 18, fontWeight: '700', color: colors.onPrimary, marginBottom: 4 },
    heroSubtitle: { fontSize: 14, color: colors.onPrimary, opacity: 0.85 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 20,
      shadowColor: colors.shadowStrong,
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5,
    },
    label: { fontSize: 14, fontWeight: '600', marginTop: 14, color: colors.onSurface },
    input: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.surfaceVariant,
      color: colors.onSurface,
      fontSize: 15,
    },
    notes: { minHeight: 120, textAlignVertical: 'top' },
    saveBtnContainer: {
      marginTop: 28,
      borderRadius: 18,
      overflow: 'hidden',
      shadowColor: colors.shadowStrong,
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    saveBtnDisabled: { opacity: 0.7 },
    saveBtn: { paddingVertical: 16, alignItems: 'center' },
    saveTxt: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 },
  });

export default CreateHorseScreen;

