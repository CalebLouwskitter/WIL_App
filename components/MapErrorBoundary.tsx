/**
 * Error Boundary specifically for map-related components
 * Provides a graceful fallback UI when map components encounter errors
 */

import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { handleError } from '../utils/errorHandling';

interface Props {
  children: ReactNode;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorCount: number;
}

class MapErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Use standardized error handler
    handleError(error, {
      context: 'MapErrorBoundary',
      userMessage: 'A map error occurred. The app will try to recover.',
      severity: 'error',
      showAlert: false,
    });

    this.setState(prevState => ({
      error,
      errorCount: prevState.errorCount + 1,
    }));
  }

  handleRetry = () => {
    // If custom retry handler provided, call it
    if (this.props.onRetry) {
      this.props.onRetry();
    }
    
    // Reset error state
    this.setState({ 
      hasError: false, 
      error: undefined,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.iconContainer}>
              <Feather name="map" size={64} color="#94A3B8" />
              <View style={styles.errorBadge}>
                <Feather name="alert-triangle" size={24} color="#DC2626" />
              </View>
            </View>

            <Text style={styles.title}>Map Temporarily Unavailable</Text>
            
            <Text style={styles.message}>
              The map encountered an error and couldn't load properly. This is usually temporary.
            </Text>

            {this.state.errorCount > 2 && (
              <View style={styles.warningBox}>
                <Feather name="info" size={16} color="#F59E0B" />
                <Text style={styles.warningText}>
                  Multiple errors detected. Try restarting the app if the problem persists.
                </Text>
              </View>
            )}

            {__DEV__ && this.state.error && (
              <View style={styles.errorDetails}>
                <Text style={styles.errorTitle}>Error Details (Dev Only):</Text>
                <Text style={styles.errorText} numberOfLines={5}>
                  {this.state.error.toString()}
                </Text>
              </View>
            )}

            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
                <Feather name="refresh-cw" size={18} color="#fff" />
                <Text style={styles.retryText}>Reload Map</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.helpText}>
              If this issue continues, check your internet connection or contact support.
            </Text>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  errorBadge: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    backgroundColor: '#FEE2E2',
    borderRadius: 20,
    padding: 8,
    borderWidth: 3,
    borderColor: '#F1F5F9',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
    maxWidth: 320,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%',
    gap: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  errorDetails: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%',
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 6,
  },
  errorText: {
    fontSize: 11,
    color: '#7F1D1D',
    fontFamily: 'monospace',
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 16,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 280,
  },
});

export default MapErrorBoundary;
