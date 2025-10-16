import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  Dimensions,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { Colors } from '../constants/colors';

type MapType = 'standard' | 'satellite' | 'hybrid' | 'terrain' | 'google';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelectMapType: (type: MapType) => void;
  currentMapType: MapType;
};

const MapTypeModal: React.FC<Props> = ({ visible, onClose, onSelectMapType, currentMapType }) => {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];

  const mapTypes: Array<{ type: MapType; label: string; icon: string; description: string }> = [
    { type: 'standard', label: 'Standard', icon: 'map', description: 'Default map view' },
    { type: 'satellite', label: 'Satellite', icon: 'globe', description: 'Aerial imagery' },
    { type: 'hybrid', label: 'Hybrid', icon: 'layers', description: 'Satellite with labels' },
    { type: 'terrain', label: 'Terrain', icon: 'triangle', description: 'Topographic details' },
    { type: 'google', label: 'Google Maps', icon: 'navigation', description: 'Open in Google Maps' },
  ];

  const handleSelect = (type: MapType) => {
    onSelectMapType(type);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={[styles.modalContainer, { backgroundColor: palette.cardElevated || '#FFFFFF' }]}>
          <TouchableOpacity activeOpacity={1}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: palette.text }]}>Map Type</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Feather name="x" size={24} color={palette.text} />
              </TouchableOpacity>
            </View>

            {/* Map Type Options */}
            <View style={styles.optionsList}>
              {mapTypes.map((mapType) => (
                <TouchableOpacity
                  key={mapType.type}
                  style={[
                    styles.option,
                    { borderBottomColor: palette.border },
                    currentMapType === mapType.type && {
                      backgroundColor: palette.primary + '15',
                    },
                  ]}
                  onPress={() => handleSelect(mapType.type)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.iconContainer,
                      {
                        backgroundColor:
                          currentMapType === mapType.type
                            ? palette.primary + '30'
                            : palette.backgroundLight || '#F4F7FE',
                      },
                    ]}
                  >
                    <Feather
                      name={mapType.icon as any}
                      size={20}
                      color={currentMapType === mapType.type ? palette.primary : palette.text}
                    />
                  </View>
                  <View style={styles.optionContent}>
                    <Text
                      style={[
                        styles.optionLabel,
                        {
                          color: currentMapType === mapType.type ? palette.primary : palette.text,
                        },
                      ]}
                    >
                      {mapType.label}
                    </Text>
                    <Text
                      style={[
                        styles.optionDescription,
                        { color: palette.placeholder || '#9CA3AF' },
                      ]}
                    >
                      {mapType.description}
                    </Text>
                  </View>
                  {currentMapType === mapType.type && (
                    <Feather name="check" size={20} color={palette.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  optionsList: {
    paddingVertical: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
  },
});

export default MapTypeModal;
