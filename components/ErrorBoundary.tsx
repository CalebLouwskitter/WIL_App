import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: any;
}

interface DefaultErrorFallbackProps {
  error?: Error;
  onRetry: () => void;
}

const DefaultErrorFallback: React.FC<DefaultErrorFallbackProps> = ({ error, onRetry }) => {
  const { palette } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.content}>
        <Feather name="alert-circle" size={48} color={palette.danger} />
        <Text style={[styles.title, { color: palette.textPrimary }]}>Something went wrong</Text>
        <Text style={[styles.message, { color: palette.textSecondary }]}>
          An unexpected error occurred. Please try again or contact support if the problem persists.
        </Text>

        {__DEV__ && error && (
          <View
            style={[
              styles.errorDetails,
              {
                backgroundColor: palette.profileStatRidesBox,
                borderColor: palette.divider,
              },
            ]}
          >
            <Text style={[styles.errorTitle, { color: palette.danger }]}>
              Error Details (Development Mode):
            </Text>
            <Text style={[styles.errorText, { color: palette.textPrimary }]}>
              {error.toString()}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: palette.brandPrimary }]}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Try Again"
        >
          <Feather name="refresh-cw" size={16} color={palette.onPrimary} />
          <Text style={[styles.retryText, { color: palette.onPrimary }]}>Try Again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    maxWidth: 300,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  errorDetails: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 24,
    width: '100%',
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ErrorBoundary;
