import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather as Icon } from '@expo/vector-icons';
import { saveHorse } from '../../services/HorseStorage';
import { useColorScheme } from 'react-native';
import { Colors } from '../../constants/colors';

const CreateHorseScreen = () => {
  const nav = useNavigation<any>();
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];

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
      nav.goBack();
    } catch (e) {
      Alert.alert('Save failed', 'Could not save horse. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
            <Icon name="chevron-left" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Horse</Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="e.g. Thunder" style={styles.input} />

          <Text style={styles.label}>Breed (optional)</Text>
          <TextInput value={breed} onChangeText={setBreed} placeholder="e.g. Arabian" style={styles.input} />

          <Text style={styles.label}>Age (optional)</Text>
          <TextInput value={age} onChangeText={setAge} placeholder="e.g. 7" keyboardType="numeric" style={styles.input} />

          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Temperament, training notes, etc."
            style={[styles.input, styles.notes]}
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={onSave} activeOpacity={0.8} disabled={saving}>
          <Text style={styles.saveTxt}>{saving ? 'Saving...' : 'Save Horse'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#F4F7FE', padding: 16, paddingTop: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#fff' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 10 },
  input: { marginTop: 6, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FAFAFA' },
  notes: { height: 110, textAlignVertical: 'top' },
  saveBtn: { marginTop: 18, backgroundColor: '#2D2D2D', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  saveTxt: { color: '#fff', fontWeight: '700' },
});

export default CreateHorseScreen;

