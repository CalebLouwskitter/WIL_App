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
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAppTheme, type AppPalette } from '../../hooks/useAppTheme';
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
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const handleReturnNavigation = () => {
    if (route?.params?.fromDashboard) {
      nav.getParent<BottomTabNavigationProp<TabParamList>>()?.navigate('Dashboard');
    } else if (route?.params?.returnToSelectHorse) {
      nav.getParent<BottomTabNavigationProp<TabParamList>>()?.navigate('Mapping', { screen: 'SelectHorse' });
    } else {
      nav.goBack();
    }
  };

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
      handleReturnNavigation();
    } catch (e) {
      Alert.alert('Save failed', 'Could not save horse. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScreenHeader
        title="Add Horse"
        onBack={handleReturnNavigation}
        backLabel="Go back"
      />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <LinearGradient
          colors={[palette.gradientPrimaryStart, palette.gradientPrimaryEnd] as const}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroContent}>
            <View style={styles.heroIconWrapper}>
              <Icon name="compass" size={20} color={palette.onPrimary} />
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
            placeholderTextColor={palette.textMuted}
            style={styles.input}
            selectionColor={palette.brandPrimary}
          />

          <Text style={styles.label}>Breed (optional)</Text>
          <TextInput
            value={breed}
            accessibilityLabel="Breed (optional)"
            onChangeText={setBreed}
            placeholder="e.g. Arabian"
            placeholderTextColor={palette.textMuted}
            style={styles.input}
            selectionColor={palette.brandPrimary}
          />

          <Text style={styles.label}>Age (optional)</Text>
          <TextInput
            value={age}
            accessibilityLabel="Age in years (optional)"
            onChangeText={setAge}
            placeholder="e.g. 7"
            placeholderTextColor={palette.textMuted}
            keyboardType="numeric"
            style={styles.input}
            selectionColor={palette.brandPrimary}
          />

          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            value={notes}
            accessibilityLabel="Notes (optional)"
            onChangeText={setNotes}
            placeholder="Temperament, training notes, etc."
            placeholderTextColor={palette.textMuted}
            style={[styles.input, styles.notes]}
            multiline
            numberOfLines={4}
            selectionColor={palette.brandPrimary}
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
            colors={[palette.brandPrimary, palette.brandPrimaryAlt] as const}
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

const createStyles = (palette: AppPalette) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: palette.background },
    container: { flexGrow: 1, padding: Spacing.md, paddingBottom: Spacing.xl },
    heroCard: {
      borderRadius: BorderRadius.xl,
      padding: Spacing.md,
      shadowColor: palette.shadowStrong,
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
    heroTitle: { fontSize: 18, fontWeight: '700', color: palette.onPrimary, marginBottom: 4 },
    heroSubtitle: { fontSize: 14, color: palette.onPrimary, opacity: 0.85 },
    card: {
      backgroundColor: palette.card,
      borderRadius: BorderRadius.xl,
      padding: Spacing.md,
      shadowColor: palette.shadowStrong,
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5,
    },
    label: { ...Typography.caption, marginTop: Spacing.md, color: palette.textPrimary },
    input: {
      ...ComponentStyles.input,
      marginTop: Spacing.sm,
      borderColor: palette.divider,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: palette.surfaceVariant,
      color: palette.textPrimary,
    },
    notes: { minHeight: 120, textAlignVertical: 'top' },
    saveBtnContainer: {
      marginTop: Spacing.lg,
      borderRadius: BorderRadius.lg,
      overflow: 'hidden',
      shadowColor: palette.shadowStrong,
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    saveBtnDisabled: { opacity: 0.7 },
    saveBtn: { ...ComponentStyles.button.primary, paddingVertical: Spacing.md },
    saveTxt: { ...Typography.button, color: palette.onPrimary },
  });

export default CreateHorseScreen;
