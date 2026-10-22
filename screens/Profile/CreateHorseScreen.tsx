import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { ProfileStackParamList, TabParamList } from '../../navigation/types';
import { Feather as Icon } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { saveHorse } from '../../services/HorseStorage';
import { useColorScheme } from 'react-native';
import { Colors } from '../../constants/colors';
import { BorderRadius, ComponentStyles, Spacing, Typography } from '../../constants/styleguide';

type CreateHorseRouteProp = RouteProp<ProfileStackParamList, 'CreateHorse'>;
type CreateHorseNavigationProp = StackNavigationProp<ProfileStackParamList, 'CreateHorse'>;

const CreateHorseScreen = () => {
  const nav = useNavigation<CreateHorseNavigationProp>();
  const route = useRoute<CreateHorseRouteProp>();
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
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
        nav.getParent<BottomTabNavigationProp<TabParamList>>()?.navigate('Dashboard');
      } else if (route?.params?.returnToSelectHorse) {
        nav.getParent<BottomTabNavigationProp<TabParamList>>()?.navigate('Mapping', { screen: 'SelectHorse' });
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
                nav.getParent<BottomTabNavigationProp<TabParamList>>()?.navigate('Dashboard');
              } else if (route?.params?.returnToSelectHorse) {
                nav.getParent<BottomTabNavigationProp<TabParamList>>()?.navigate('Mapping', { screen: 'SelectHorse' });
              } else {
                nav.goBack();
              }
            }}
            style={styles.backBtn}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Go back"
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
            accessibilityLabel="Horse name"
            onChangeText={setName}
            placeholder="e.g. Thunder"
            placeholderTextColor={placeholderColor}
            style={styles.input}
            selectionColor={colors.brandPrimary}
          />

          <Text style={styles.label}>Breed (optional)</Text>
          <TextInput
            value={breed}
            accessibilityLabel="Breed (optional)"
            onChangeText={setBreed}
            placeholder="e.g. Arabian"
            placeholderTextColor={placeholderColor}
            style={styles.input}
            selectionColor={colors.brandPrimary}
          />

          <Text style={styles.label}>Age (optional)</Text>
          <TextInput
            value={age}
            accessibilityLabel="Age in years (optional)"
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
            accessibilityLabel="Notes (optional)"
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
          accessibilityRole="button"
          accessibilityLabel={saving ? 'Saving horse' : 'Save horse'}
          accessibilityState={{ disabled: saving, busy: saving }}
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
    container: { flexGrow: 1, padding: Spacing.md, paddingTop: Spacing.xxl, paddingBottom: Spacing.xl },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
    backBtn: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 24,
      backgroundColor: colors.surface,
      shadowColor: colors.shadowStrong,
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    headerTitle: { ...Typography.subtitle, flex: 1, textAlign: 'center', color: colors.onSurface },
    headerSpacer: { width: 48 },
    heroCard: {
      borderRadius: BorderRadius.xl,
      padding: Spacing.md,
      shadowColor: colors.shadowStrong,
      shadowOpacity: 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
      marginBottom: Spacing.lg,
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
      borderRadius: BorderRadius.xl,
      padding: Spacing.md,
      shadowColor: colors.shadowStrong,
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5,
    },
    label: { ...Typography.caption, marginTop: Spacing.md, color: colors.onSurface },
    input: {
      ...ComponentStyles.input,
      marginTop: Spacing.sm,
      borderColor: colors.borderMuted,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: colors.surfaceVariant,
      color: colors.onSurface,
    },
    notes: { minHeight: 120, textAlignVertical: 'top' },
    saveBtnContainer: {
      marginTop: Spacing.lg,
      borderRadius: BorderRadius.lg,
      overflow: 'hidden',
      shadowColor: colors.shadowStrong,
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    saveBtnDisabled: { opacity: 0.7 },
    saveBtn: { ...ComponentStyles.button.primary, paddingVertical: Spacing.md },
    saveTxt: { ...Typography.button, color: colors.onPrimary },
  });

export default CreateHorseScreen;

